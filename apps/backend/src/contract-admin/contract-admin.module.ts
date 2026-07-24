import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractAdminGuard } from '../common/guards/contract-admin.guard';
import { ContractAdminAuditService } from './contract-admin-audit.service';
import { AdminBlockchainAuditLog } from '../admin-audit/entities/admin-blockchain-audit-log.entity';
import { AccessControlModule } from '../common/access-control.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminBlockchainAuditLog]),
    AccessControlModule,
  ],
  providers: [ContractAdminGuard, ContractAdminAuditService],
  exports: [ContractAdminGuard, ContractAdminAuditService],
})
export class ContractAdminModule {}
