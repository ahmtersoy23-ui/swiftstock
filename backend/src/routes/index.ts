// ============================================
// ROUTE AGGREGATOR
// Modüler mimari — her modülün route'ları kendi dosyasında.
// Bu dosya sadece mount eder, mantık içermez.
//
// Module Map:
//   auth.routes.ts        → Auth + User Management
//   catalog.routes.ts     → Module 1: Products (READ-ONLY), Serials, Scan
//   warehouse.routes.ts   → Module 2: Warehouses, Locations, Containers
//   orders.routes.ts      → Module 3: Order Fulfillment & Picking
//   inventory.routes.ts   → Module 4: Inventory Core & Transactions
//   quality.routes.ts     → Module 5: Cycle Count & Reports
//   shipments.routes.ts   → Module 6: Virtual Shipments & Boxes
//   returns.routes.ts     → Module 7: RMA / Returns
//   operations.routes.ts  → Module 8: Operation Modes & Scan Sessions
// ============================================

import { Router } from 'express';
import authRoutes from './auth.routes';
import catalogRoutes from './catalog.routes';
import warehouseRoutes from './warehouse.routes';
import ordersRoutes from './orders.routes';
import inventoryRoutes from './inventory.routes';
import qualityRoutes from './quality.routes';
import shipmentsRoutes from './shipments.routes';
import returnsRoutes from './returns.routes';
import operationsRoutes from './operations.routes';
import dashboardRoutes from './dashboard.routes';
import alertsRoutes from './alerts.routes';
import omsRoutes from './oms.routes';
import kittingRoutes from './kitting.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

// ── Module Routes ──────────────────────────────────────────────────────────
router.use('/', authRoutes);       // Auth + User Management
router.use('/', catalogRoutes);    // Module 1: Catalog + Barcoding
router.use('/', warehouseRoutes);  // Module 2: Warehouse Placement
router.use('/', ordersRoutes);     // Module 3: Order Fulfillment
router.use('/', inventoryRoutes);  // Module 4: Inventory Core
router.use('/', qualityRoutes);    // Module 5: Cycle Count & Quality
router.use('/', shipmentsRoutes);  // Module 6: Shipments
router.use('/', returnsRoutes);    // Module 7: Returns / RMA
router.use('/', operationsRoutes); // Module 8: Operations Engine
router.use('/', dashboardRoutes);  // Dashboard KPIs
router.use('/', alertsRoutes);     // Alerts / Notifications
router.use('/', omsRoutes);        // OMS Integration API
router.use('/', kittingRoutes);    // Kitting / Assembly
router.use('/', analyticsRoutes);  // Analytics & Intelligence

// ── Health Check ───────────────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'WMS API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
