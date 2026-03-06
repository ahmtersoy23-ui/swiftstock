// ============================================
// EVENT BUS — In-process typed EventEmitter
// Modular monolith için inter-module communication.
// RabbitMQ/Kafka gereksiz — tek PM2 process, tek DB.
// Gelecekte external queue'ya kolayca upgrade edilebilir.
// ============================================

import { EventEmitter } from 'events';
import logger from '../../../utils/logger';

// ── Event Payloads ─────────────────────────────────────────────────────────

export interface ContainerOpenedPayload {
  containerId: number;
  containerBarcode: string;
  warehouseId: number;
  locationId: number | null;
  contents: Array<{
    productSku: string;
    quantity: number;
  }>;
  openedByUserId: number;
}

export interface CycleCountCompletedPayload {
  sessionId: number;
  warehouseId: number;
  adjustments: Array<{
    productSku: string;
    locationId: number;
    systemQty: number;
    countedQty: number;
    delta: number;
  }>;
  completedByUserId: number;
}

export interface InventoryAdjustedPayload {
  productSku: string;
  warehouseId: number;
  locationId: number | null;
  delta: number;
  reason: string;
  transactionId?: number;
}

export interface OrderPickedPayload {
  orderId: number;
  pickListId: number;
  items: Array<{
    productSku: string;
    quantityPicked: number;
  }>;
  pickedByUserId: number;
}

// ── Event Map (typed) ──────────────────────────────────────────────────────

export interface WmsEvents {
  'container:opened': ContainerOpenedPayload;
  'cyclecount:completed': CycleCountCompletedPayload;
  'inventory:adjusted': InventoryAdjustedPayload;
  'order:picked': OrderPickedPayload;
}

// ── Typed EventEmitter ─────────────────────────────────────────────────────

class WmsEventBus extends EventEmitter {
  emit<K extends keyof WmsEvents>(event: K, payload: WmsEvents[K]): boolean {
    logger.debug(`[EventBus] emit: ${event}`, { payload });
    return super.emit(event, payload);
  }

  on<K extends keyof WmsEvents>(
    event: K,
    listener: (payload: WmsEvents[K]) => void
  ): this {
    return super.on(event, listener);
  }

  once<K extends keyof WmsEvents>(
    event: K,
    listener: (payload: WmsEvents[K]) => void
  ): this {
    return super.once(event, listener);
  }

  off<K extends keyof WmsEvents>(
    event: K,
    listener: (payload: WmsEvents[K]) => void
  ): this {
    return super.off(event, listener);
  }
}

// Singleton — tüm modüller bu instance'ı kullanır
export const eventBus = new WmsEventBus();

// Uncaught emitter error'larını logla (production güvenliği)
eventBus.on('error' as keyof WmsEvents, (err: unknown) => {
  logger.error('[EventBus] Unhandled event error:', err);
});

// EventEmitter memory leak uyarısını bastır — çok sayıda listener normal
eventBus.setMaxListeners(50);
