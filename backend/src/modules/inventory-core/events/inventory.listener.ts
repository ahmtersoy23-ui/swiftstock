// ============================================
// INVENTORY LISTENER — Module 4 (Inventory Core)
// container:opened ve cyclecount:completed event'lerini dinler.
// ============================================

import { eventBus } from '../../shared/events/event-bus';
import logger from '../../../config/logger';
import { transactionService } from '../services/transaction.service';
import { inventoryService } from '../services/inventory.service';

// ── container:opened ──────────────────────────────────────────────────────────
// Container açıldığında: IN transaction yarat, inventory güncelle.

eventBus.on('container:opened', async (payload) => {
  try {
    const { containerId, containerBarcode, warehouseId, locationId, contents, openedByUserId } = payload;

    if (contents.length === 0) {
      logger.info('[InventoryListener] container:opened — empty container, skipping', { containerId });
      return;
    }

    await transactionService.createTransaction({
      transaction_type: 'IN',
      warehouse_id: warehouseId,
      location_id: locationId ?? undefined,
      items: contents.map((c) => ({
        product_sku: c.productSku,
        quantity: c.quantity,
        unit_type: 'EACH',
      })),
      notes: `Unpacked container ${containerBarcode}`,
      created_by: String(openedByUserId),
      reference_no: `CONTAINER-${containerId}`,
    });

    logger.info('[InventoryListener] container:opened — IN transaction created', {
      containerId,
      containerBarcode,
      itemCount: contents.length,
    });
  } catch (error) {
    logger.error('[InventoryListener] container:opened — unhandled error', { error });
  }
});

// ── cyclecount:completed ──────────────────────────────────────────────────────
// Sayım tamamlandığında: inventory quantity_each güncelle.

eventBus.on('cyclecount:completed', async (payload) => {
  try {
    const { sessionId, warehouseId, adjustments, completedByUserId } = payload;

    if (adjustments.length === 0) {
      logger.info('[InventoryListener] cyclecount:completed — no adjustments, skipping', { sessionId });
      return;
    }

    await inventoryService.adjustStock(
      adjustments.map((adj) => ({
        productSku: adj.productSku,
        warehouseId,
        locationId: adj.locationId,
        delta: adj.delta,
      })),
    );

    logger.info('[InventoryListener] cyclecount:completed — stock adjusted', {
      sessionId,
      adjustmentCount: adjustments.length,
      completedByUserId,
    });
  } catch (error) {
    logger.error('[InventoryListener] cyclecount:completed — unhandled error', { error });
  }
});
