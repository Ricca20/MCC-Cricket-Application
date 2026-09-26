import Dexie, { Table } from 'dexie';

export interface QueuedDelivery {
  id?: number; // Auto-incremented local ID
  clientEntryId: string;
  matchId: string;
  over: number;
  ballInOver: number;
  bowler: string;
  bowlerName: string;
  batsman: string;
  batsmanName: string;
  runs: number;
  extraType?: string;
  wicket?: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
}

export class MCCDatabase extends Dexie {
  deliveriesQueue!: Table<QueuedDelivery, number>;

  constructor() {
    super('MCCDatabase');
    this.version(1).stores({
      deliveriesQueue: '++id, clientEntryId, matchId, status, timestamp'
    });
  }
}

export const db = new MCCDatabase();

// Sync helper function (to be called by Service Worker or online event listener)
export const syncOfflineDeliveries = async (apiClient: any) => {
  const pendingDeliveries = await db.deliveriesQueue
    .where('status')
    .equals('pending')
    .toArray();

  if (pendingDeliveries.length === 0) return;

  for (const delivery of pendingDeliveries) {
    try {
      // Mark as syncing
      await db.deliveriesQueue.update(delivery.id!, { status: 'syncing' });
      
      // Attempt to push to backend
      await apiClient.post(`/matches/${delivery.matchId}/deliveries`, delivery);
      
      // Success: remove from queue
      await db.deliveriesQueue.delete(delivery.id!);
    } catch (error: any) {
      // If duplicate (already recorded), safe to remove
      if (error.response?.data?.message?.includes('duplicate')) {
        await db.deliveriesQueue.delete(delivery.id!);
      } else {
        // Revert to pending for retry later
        await db.deliveriesQueue.update(delivery.id!, { status: 'pending' });
      }
    }
  }
};
