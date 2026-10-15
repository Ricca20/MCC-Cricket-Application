import Dexie, { Table } from 'dexie';
import type { AxiosError, AxiosInstance } from 'axios';
import type { ExtraType, WicketType } from './cricket';

export interface PlayerRef {
  id?: string | null; // set for registered club members
  name: string;
}

export interface DeliveryPayload {
  clientEntryId: string;
  inningsNumber: 1 | 2;
  batsman: PlayerRef;
  nonStriker?: PlayerRef;
  bowler: PlayerRef;
  runs: number;
  extraType: ExtraType | null;
  wicket: { type: WicketType; playerOut: PlayerRef; fielder?: PlayerRef } | null;
}

export interface QueuedDelivery {
  id?: number; // Auto-incremented local ID, preserves ball order
  matchId: string;
  payload: DeliveryPayload;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

export class MCCDatabase extends Dexie {
  deliveriesQueue!: Table<QueuedDelivery, number>;

  constructor() {
    super('MCCDatabase');
    this.version(1).stores({
      deliveriesQueue: '++id, clientEntryId, matchId, status, timestamp'
    });
    // v2 stores the server payload as-is; v1 rows came from the old mock scorer
    this.version(2).stores({
      deliveriesQueue: '++id, matchId, status, timestamp'
    }).upgrade((tx) => tx.table('deliveriesQueue').clear());
  }
}

export const db = new MCCDatabase();

export interface SyncResult {
  synced: number;
  failed: number;
  pending: number;
}

// A missing response, a server error, an expired session or a rate limit are
// temporary: keep the ball and retry later. Any other 4xx is a real rejection.
const isRetryable = (error: AxiosError) => {
  const status = error.response?.status;
  return !status || status >= 500 || status === 401 || status === 429;
};

let running: Promise<SyncResult> | null = null;

const runSync = async (apiClient: AxiosInstance, matchId: string): Promise<SyncResult> => {
  // Rows left 'syncing' by a closed tab go back in the queue
  await db.deliveriesQueue.where({ matchId, status: 'syncing' }).modify({ status: 'pending' });

  const queue = await db.deliveriesQueue.where({ matchId, status: 'pending' }).sortBy('id');
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    await db.deliveriesQueue.update(item.id!, { status: 'syncing' });
    try {
      await apiClient.post(`/matches/${matchId}/deliveries`, item.payload);
      await db.deliveriesQueue.delete(item.id!); // also covers "already recorded" replies
      synced += 1;
    } catch (err) {
      const error = err as AxiosError<{ message?: string }>;
      if (isRetryable(error)) {
        await db.deliveriesQueue.update(item.id!, { status: 'pending' });
        break; // keep later balls behind this one so order is preserved
      }
      await db.deliveriesQueue.update(item.id!, {
        status: 'failed',
        error: error.response?.data?.message || 'Rejected by server'
      });
      failed += 1;
    }
  }

  const pending = await db.deliveriesQueue.where({ matchId, status: 'pending' }).count();
  return { synced, failed, pending };
};

// Sends queued balls in order. Concurrent callers share one run.
export const syncOfflineDeliveries = (apiClient: AxiosInstance, matchId: string) => {
  running ??= runSync(apiClient, matchId).finally(() => {
    running = null;
  });
  return running;
};
