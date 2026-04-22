// Offline order queue backed by IndexedDB.
//
// When the POS creates an order and the network is offline (or the API
// returns a 5xx / connection error), the order is persisted here. A
// background flush retries on reconnect and on app-focus.
//
// This file is intentionally tiny and framework-agnostic — no React. It's
// consumed by `src/hooks/useCreateOrder.ts`.

import type { OrderType } from '@/stores/cart';

const DB_NAME = 'flick';
const STORE = 'offline_orders';
const VERSION = 1;

export interface QueuedOrder {
  id: string; // client-generated
  createdAt: number;
  payload: {
    type: OrderType;
    tableNumber?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    discountAmount: number;
    discountPercent: number;
    notes?: string;
    items: Array<{
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
      modifiers?: Array<{ modifierName: string; priceAdd: number }>;
    }>;
  };
  attempts: number;
  lastError?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const req = run(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export async function enqueue(order: QueuedOrder): Promise<void> {
  await tx('readwrite', (s) => s.put(order));
}

export async function listQueued(): Promise<QueuedOrder[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<QueuedOrder[]>);
}

export async function removeQueued(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function updateQueued(order: QueuedOrder): Promise<void> {
  await tx('readwrite', (s) => s.put(order));
}
