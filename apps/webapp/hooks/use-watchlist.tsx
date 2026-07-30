"use client";

import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import {
  WatchlistApiService,
  WatchlistItem,
  WatchlistItemType,
  AddToWatchlistPayload,
  ToggleWatchlistResult,
} from "@/lib/watchlist-service";

interface WatchlistState {
  items: WatchlistItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (payload: AddToWatchlistPayload) => Promise<WatchlistItem>;
  removeItem: (itemId: string) => Promise<void>;
  toggleItem: (payload: AddToWatchlistPayload) => Promise<ToggleWatchlistResult>;
  isInWatchlist: (symbol: string, type?: WatchlistItemType) => boolean;
  savedProjectIds: number[];
  isProjectSaved: (projectId: number) => boolean;
  toggleSavedProject: (projectId: number) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistState>({
  items: [],
  total: 0,
  isLoading: false,
  error: null,
  refresh: async () => {},
  addItem: async () => ({}) as WatchlistItem,
  removeItem: async () => {},
  toggleItem: async () => ({ added: false }),
  isInWatchlist: () => false,
  savedProjectIds: [],
  isProjectSaved: () => false,
  toggleSavedProject: async () => {},
});

export function useWatchlist() {
  return useContext(WatchlistContext);
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await WatchlistApiService.getWatchlist();
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (payload: AddToWatchlistPayload): Promise<WatchlistItem> => {
      const optimisticId = `temp-${Date.now()}`;
      const newItem: WatchlistItem = {
        id: optimisticId,
        userId: 'temp',
        symbol: payload.symbol,
        type: payload.type,
        name: payload.name || null,
        assetIssuer: payload.assetIssuer || null,
        imageUrl: payload.imageUrl || null,
        notes: payload.notes || null,
        sortOrder: payload.sortOrder || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setItems((prev) => [...prev, newItem]);

      try {
        const item = await WatchlistApiService.addItem(payload);
        setItems((prev) => prev.map(i => i.id === optimisticId ? item : i));
        return item;
      } catch (err) {
        setItems((prev) => prev.filter(i => i.id !== optimisticId));
        setError(err instanceof Error ? err.message : "Failed to add item");
        throw err;
      }
    },
    [],
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<void> => {
      const prevItems = [...items];
      setItems((prev) => prev.filter((i) => i.id !== itemId));

      try {
        await WatchlistApiService.removeItem(itemId);
      } catch (err) {
        setItems(prevItems);
        setError(err instanceof Error ? err.message : "Failed to remove item");
        throw err;
      }
    },
    [items],
  );

  const toggleItem = useCallback(
    async (payload: AddToWatchlistPayload): Promise<ToggleWatchlistResult> => {
      const existingItem = items.find(
        (i) => i.symbol.toUpperCase() === payload.symbol.toUpperCase() && i.type === payload.type
      );
      
      const isRemoving = !!existingItem;
      const optimisticId = `temp-${Date.now()}`;
      const prevItems = [...items];
      
      if (isRemoving) {
        setItems((prev) => prev.filter((i) => i.id !== existingItem.id));
      } else {
        const newItem: WatchlistItem = {
          id: optimisticId,
          userId: 'temp',
          symbol: payload.symbol,
          type: payload.type,
          name: payload.name || null,
          assetIssuer: payload.assetIssuer || null,
          imageUrl: payload.imageUrl || null,
          notes: payload.notes || null,
          sortOrder: payload.sortOrder || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setItems((prev) => [...prev, newItem]);
      }
      
      try {
        const result = await WatchlistApiService.toggleItem(payload);
        // Sync full state in background to ensure correct IDs and totals
        WatchlistApiService.getWatchlist().then(res => {
          setItems(res.items);
          setTotal(res.total);
        }).catch(() => {});
        return result;
      } catch (err) {
        setItems(prevItems);
        setError(err instanceof Error ? err.message : "Failed to toggle item");
        throw err;
      }
    },
    [items],
  );

  const isInWatchlist = useCallback(
    (symbol: string, type?: WatchlistItemType): boolean => {
      return items.some(
        (item: WatchlistItem) =>
          item.symbol.toUpperCase() === symbol.toUpperCase() &&
          (!type || item.type === type),
      );
    },
    [items],
  );

  const savedProjectIds = items
    .filter((item) => item.type === WatchlistItemType.PROJECT)
    .map((item) => parseInt(item.symbol, 10))
    .filter((id) => !isNaN(id));

  const isProjectSaved = useCallback(
    (projectId: number): boolean => {
      return isInWatchlist(String(projectId), WatchlistItemType.PROJECT);
    },
    [isInWatchlist],
  );

  const toggleSavedProject = useCallback(
    async (projectId: number): Promise<void> => {
      try {
        await toggleItem({
          symbol: String(projectId),
          type: WatchlistItemType.PROJECT,
        });
      } catch (err) {
        console.error("Failed to toggle project", err);
      }
    },
    [toggleItem],
  );

  return (
    <WatchlistContext.Provider
      value={{
        items,
        total,
        isLoading,
        error,
        refresh,
        addItem,
        removeItem,
        toggleItem,
        isInWatchlist,
        savedProjectIds,
        isProjectSaved,
        toggleSavedProject,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}
