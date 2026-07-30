import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReadModelRebuildService } from './read-model-rebuild.service';
import { RebuildDataset, RebuildStatus } from './entities/read-model-rebuild-job.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadModelRebuildJob } from './entities/read-model-rebuild-job.entity';

@Injectable()
export class ReadModelRebuildScheduler {
  private readonly logger = new Logger(ReadModelRebuildScheduler.name);

  constructor(
    private readonly rebuildService: ReadModelRebuildService,
    @InjectRepository(ReadModelRebuildJob)
    private readonly jobRepo: Repository<ReadModelRebuildJob>,
  ) {}

  /**
   * Daily cleanup of old rebuild jobs at 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldJobs(): Promise<void> {
    this.logger.log('Running scheduled cleanup of old rebuild jobs...');
    try {
      const result = await this.rebuildService.cleanupJobs(30);
      this.logger.log(`Cleanup completed: ${result.deleted} jobs deleted`);
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Check for stuck jobs every hour and attempt recovery
   */
  @Cron(CronExpression.EVERY_HOUR)
  async recoverStuckJobs(): Promise<void> {
    const stuckThreshold = new Date();
    stuckThreshold.setHours(stuckThreshold.getHours() - 2); // 2 hours

    try {
      const stuckJobs = await this.jobRepo.find({
        where: {
          status: RebuildStatus.IN_PROGRESS,
          updatedAt: stuckThreshold,
        },
      });

      if (stuckJobs.length === 0) {
        return;
      }

      this.logger.warn(`Found ${stuckJobs.length} stuck rebuild jobs, attempting recovery...`);

      for (const job of stuckJobs) {
        job.status = RebuildStatus.FAILED;
        job.errorMessage = 'Job timed out after 2 hours';
        job.completedAt = new Date();
        job.progressDetails = {
          phase: 'failed',
          error: 'Job timed out after 2 hours',
          recoveredAt: new Date().toISOString(),
        };
        await this.jobRepo.save(job);
        this.logger.warn(`Recovered stuck job ${job.id}`);
      }
    } catch (error) {
      this.logger.error(`Stuck job recovery failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Optional: Weekly full rebuild of all datasets
   * Disabled by default - uncomment to enable
   */
  // @Cron(CronExpression.EVERY_WEEK)
  // async weeklyFullRebuild(): Promise<void> {
  //   this.logger.log('Starting weekly full rebuild of all datasets...');
  //   // This would need system user ID
  //   // await this.rebuildService.triggerRebuild({
  //   //   dataset: RebuildDataset.ALL,
  //   //   reason: 'Weekly full rebuild',
  //   //   force: true,
  //   // }, 'system');
  // }
}