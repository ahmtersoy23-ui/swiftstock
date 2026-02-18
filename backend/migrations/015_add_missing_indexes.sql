-- ============================================
-- MIGRATION 015: Add Missing Database Indexes
-- ============================================
-- Identified from SQL query patterns across all controllers
-- Uses CREATE INDEX IF NOT EXISTS to be idempotent

-- ============================================
-- PRODUCTS TABLE
-- ============================================

-- WHERE product_sku = $1 (used heavily in product.controller, scan.controller, serial.controller, transaction.controller)
CREATE INDEX IF NOT EXISTS idx_products_product_sku
  ON products(product_sku);

-- WHERE barcode = $1 (scan.controller - scanCode, transaction.controller)
CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode);

-- WHERE product_sku IS NOT NULL ORDER BY name (product.controller - getAllProducts, searchProducts)
CREATE INDEX IF NOT EXISTS idx_products_sku_not_null_name
  ON products(name) WHERE product_sku IS NOT NULL;

-- ============================================
-- SERIAL NUMBERS TABLE
-- ============================================

-- WHERE sn.product_sku = $1 (serial.controller - getSerialNumbers, getSerialStats)
CREATE INDEX IF NOT EXISTS idx_serial_numbers_product_sku
  ON serial_numbers(product_sku);

-- WHERE sn.full_barcode = $1 (serial.controller - lookupSerialBarcode, updateSerialStatus, getSerialHistory)
CREATE INDEX IF NOT EXISTS idx_serial_numbers_full_barcode
  ON serial_numbers(full_barcode);

-- WHERE sn.product_sku = $1 AND sn.status = $2 (serial.controller - getSerialNumbers with status filter)
CREATE INDEX IF NOT EXISTS idx_serial_numbers_product_sku_status
  ON serial_numbers(product_sku, status);

-- ORDER BY sn.serial_id DESC (serial.controller - getSerialNumbers)
CREATE INDEX IF NOT EXISTS idx_serial_numbers_serial_id_desc
  ON serial_numbers(serial_id DESC);

-- ============================================
-- SERIAL HISTORY TABLE
-- ============================================

-- WHERE sh.full_barcode = $1 ORDER BY sh.created_at DESC (serial.controller - getSerialHistory)
CREATE INDEX IF NOT EXISTS idx_serial_history_full_barcode
  ON serial_history(full_barcode, created_at DESC);

-- ============================================
-- WMS WAREHOUSES TABLE
-- ============================================

-- WHERE code = $1 (used everywhere: warehouse.controller, transaction.controller, scan.controller, etc.)
CREATE INDEX IF NOT EXISTS idx_wms_warehouses_code
  ON wms_warehouses(code);

-- WHERE warehouse_id = $1 (warehouse.controller - getWarehouseById)
-- Note: warehouse_id is likely PK, but adding for safety
CREATE INDEX IF NOT EXISTS idx_wms_warehouses_warehouse_id
  ON wms_warehouses(warehouse_id);

-- WHERE is_active = true ORDER BY code (warehouse.controller - getAllWarehouses)
CREATE INDEX IF NOT EXISTS idx_wms_warehouses_active_code
  ON wms_warehouses(code) WHERE is_active = true;

-- ============================================
-- WMS LOCATIONS TABLE
-- ============================================

-- WHERE l.location_code = $1 (location.controller - getLocationByCode)
CREATE INDEX IF NOT EXISTS idx_wms_locations_location_code
  ON wms_locations(location_code);

-- WHERE l.qr_code = $1 (transaction.controller, scan.controller)
CREATE INDEX IF NOT EXISTS idx_wms_locations_qr_code
  ON wms_locations(qr_code);

-- WHERE l.qr_code = $1 AND l.is_active = true (scan.controller - scanCode)
CREATE INDEX IF NOT EXISTS idx_wms_locations_qr_active
  ON wms_locations(qr_code) WHERE is_active = true;

-- WHERE warehouse_id = $1 AND qr_code LIKE '%-MAIN' (transaction.controller - default location)
CREATE INDEX IF NOT EXISTS idx_wms_locations_warehouse_qr
  ON wms_locations(warehouse_id, qr_code);

-- WHERE warehouse_id AND zone (location.controller - getAllLocations)
CREATE INDEX IF NOT EXISTS idx_wms_locations_warehouse_zone
  ON wms_locations(warehouse_id, zone);

-- ORDER BY location_code (location.controller)
CREATE INDEX IF NOT EXISTS idx_wms_locations_order_code
  ON wms_locations(location_code);

-- ============================================
-- INVENTORY TABLE
-- ============================================

-- WHERE product_sku = $1 AND warehouse_id = $2 AND location_id = $3 (transaction.controller)
CREATE INDEX IF NOT EXISTS idx_inventory_sku_warehouse_location
  ON inventory(product_sku, warehouse_id, location_id);

-- WHERE i.product_sku = $1 AND i.quantity_each > 0 (inventory.controller - getInventoryBySku)
CREATE INDEX IF NOT EXISTS idx_inventory_product_sku_qty
  ON inventory(product_sku) WHERE quantity_each > 0;

-- WHERE i.warehouse_id = $1 AND i.quantity_on_hand > 0 (report.controller - getInventoryReport)
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_qty
  ON inventory(warehouse_id) WHERE quantity_on_hand > 0;

-- WHERE i.location_id = $1 AND i.quantity_each > 0 (scan.controller)
CREATE INDEX IF NOT EXISTS idx_inventory_location_qty
  ON inventory(location_id) WHERE quantity_each > 0;

-- WHERE i.quantity_each <= threshold AND i.quantity_each > 0 (inventory.controller - getLowStock)
CREATE INDEX IF NOT EXISTS idx_inventory_qty_each_asc
  ON inventory(quantity_each ASC) WHERE quantity_each > 0;

-- ============================================
-- LOCATION INVENTORY TABLE
-- ============================================

-- WHERE li.product_sku = $1 AND l.warehouse_id (order.controller - createOrder location find)
CREATE INDEX IF NOT EXISTS idx_location_inventory_product_sku
  ON location_inventory(product_sku);

-- WHERE li.location_id = $1 (location.controller - getLocationInventory, deleteLocation check)
CREATE INDEX IF NOT EXISTS idx_location_inventory_location_id
  ON location_inventory(location_id);

-- ============================================
-- WMS CONTAINERS TABLE
-- ============================================

-- WHERE c.barcode = $1 (container.controller - getContainerByBarcode, openContainer)
CREATE INDEX IF NOT EXISTS idx_wms_containers_barcode
  ON wms_containers(barcode);

-- WHERE barcode LIKE 'KOL-%' / 'PAL-%' (container.controller - createContainer sequence)
CREATE INDEX IF NOT EXISTS idx_wms_containers_barcode_pattern
  ON wms_containers(barcode text_pattern_ops);

-- WHERE c.status = $1 (container.controller - getAllContainers, openContainer)
CREATE INDEX IF NOT EXISTS idx_wms_containers_status
  ON wms_containers(status);

-- WHERE c.warehouse_id = $1 (container.controller - getAllContainers)
CREATE INDEX IF NOT EXISTS idx_wms_containers_warehouse
  ON wms_containers(warehouse_id);

-- ORDER BY c.created_at DESC (container.controller - getAllContainers)
CREATE INDEX IF NOT EXISTS idx_wms_containers_created_desc
  ON wms_containers(created_at DESC);

-- ============================================
-- WMS CONTAINER CONTENTS TABLE
-- ============================================

-- WHERE cc.container_id = $1 (container.controller, scan.controller)
CREATE INDEX IF NOT EXISTS idx_wms_container_contents_container
  ON wms_container_contents(container_id);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================

-- WHERE t.transaction_id = $1 (transaction.controller - getTransactionDetails, undoTransaction)
-- Note: transaction_id is likely PK but adding for safety
CREATE INDEX IF NOT EXISTS idx_transactions_id
  ON transactions(transaction_id);

-- ORDER BY t.created_at DESC (transaction.controller - getRecentTransactions)
CREATE INDEX IF NOT EXISTS idx_transactions_created_desc
  ON transactions(created_at DESC);

-- ============================================
-- TRANSACTION ITEMS TABLE
-- ============================================

-- WHERE ti.transaction_id = $1 (transaction.controller - getTransactionDetails, undoTransaction)
CREATE INDEX IF NOT EXISTS idx_transaction_items_txn_id
  ON transaction_items(transaction_id);

-- ============================================
-- SCAN SESSIONS TABLE
-- ============================================

-- WHERE s.user_name = $1 AND s.status = 'ACTIVE' (operation.controller - getActiveScanSession, createScanSession)
CREATE INDEX IF NOT EXISTS idx_scan_sessions_username_active
  ON scan_sessions(user_name) WHERE status = 'ACTIVE';

-- WHERE s.session_id = $1 (operation.controller - getScanSession)
CREATE INDEX IF NOT EXISTS idx_scan_sessions_session_id
  ON scan_sessions(session_id);

-- session_code LIKE pattern (operation.controller - generateSessionCode)
CREATE INDEX IF NOT EXISTS idx_scan_sessions_code_pattern
  ON scan_sessions(session_code text_pattern_ops);

-- ============================================
-- SCAN OPERATIONS TABLE
-- ============================================

-- WHERE so.session_id = $1 ORDER BY so.scanned_at DESC (operation.controller - getSessionOperations)
CREATE INDEX IF NOT EXISTS idx_scan_operations_session
  ON scan_operations(session_id, scanned_at DESC);

-- WHERE so.product_sku = $1 ORDER BY so.scanned_at DESC (serial.controller - getSerialHistory)
CREATE INDEX IF NOT EXISTS idx_scan_operations_product_sku
  ON scan_operations(product_sku, scanned_at DESC);

-- ============================================
-- OPERATION MODES TABLE
-- ============================================

-- WHERE mode_code = $1 (operation.controller, scan.controller)
CREATE INDEX IF NOT EXISTS idx_operation_modes_code
  ON operation_modes(mode_code);

-- WHERE is_active = true ORDER BY mode_type, mode_code (operation.controller - getAllOperationModes)
CREATE INDEX IF NOT EXISTS idx_operation_modes_active
  ON operation_modes(mode_type, mode_code) WHERE is_active = true;

-- ============================================
-- SHIPMENT ORDERS TABLE
-- ============================================

-- WHERE order_number = $1 (order.controller - createOrder duplicate check)
CREATE INDEX IF NOT EXISTS idx_shipment_orders_order_number
  ON shipment_orders(order_number);

-- WHERE so.warehouse_code = $1 (order.controller - getAllOrders)
CREATE INDEX IF NOT EXISTS idx_shipment_orders_warehouse
  ON shipment_orders(warehouse_code);

-- WHERE so.status = $1 (order.controller - getAllOrders)
CREATE INDEX IF NOT EXISTS idx_shipment_orders_status
  ON shipment_orders(status);

-- WHERE so.assigned_picker_id = $1 (order.controller - getAllOrders, getPickerPerformance)
CREATE INDEX IF NOT EXISTS idx_shipment_orders_picker
  ON shipment_orders(assigned_picker_id);

-- ORDER BY priority, order_date (order.controller - getAllOrders)
CREATE INDEX IF NOT EXISTS idx_shipment_orders_priority_date
  ON shipment_orders(priority, order_date ASC);

-- Composite for picker performance queries
CREATE INDEX IF NOT EXISTS idx_shipment_orders_picker_status
  ON shipment_orders(assigned_picker_id, status);

-- ============================================
-- SHIPMENT ORDER ITEMS TABLE
-- ============================================

-- WHERE soi.order_id = $1 (order.controller - getOrderById, completePicking)
CREATE INDEX IF NOT EXISTS idx_shipment_order_items_order
  ON shipment_order_items(order_id);

-- WHERE soi.item_id = $1 AND soi.order_id = $2 (order.controller - recordPick)
CREATE INDEX IF NOT EXISTS idx_shipment_order_items_item_order
  ON shipment_order_items(item_id, order_id);

-- ============================================
-- PICK CONFIRMATIONS TABLE
-- ============================================

-- WHERE order_id = $1 (order.controller - recordPick inserts)
CREATE INDEX IF NOT EXISTS idx_pick_confirmations_order
  ON pick_confirmations(order_id);

-- ============================================
-- VIRTUAL SHIPMENTS TABLE
-- ============================================

-- WHERE vs.source_warehouse_id = $1 (shipment.controller - getAllShipments)
CREATE INDEX IF NOT EXISTS idx_virtual_shipments_warehouse
  ON virtual_shipments(source_warehouse_id);

-- WHERE vs.status = $1 (shipment.controller - getAllShipments)
CREATE INDEX IF NOT EXISTS idx_virtual_shipments_status
  ON virtual_shipments(status);

-- WHERE prefix = $1 (shipment.controller - createShipment duplicate check)
CREATE INDEX IF NOT EXISTS idx_virtual_shipments_prefix
  ON virtual_shipments(prefix);

-- ORDER BY created_at DESC (shipment.controller - getAllShipments)
CREATE INDEX IF NOT EXISTS idx_virtual_shipments_created_desc
  ON virtual_shipments(created_at DESC);

-- ============================================
-- SHIPMENT BOXES TABLE
-- ============================================

-- WHERE sb.shipment_id = $1 (shipment.controller - getShipmentById, getShipmentBoxes, closeShipment, etc.)
CREATE INDEX IF NOT EXISTS idx_shipment_boxes_shipment
  ON shipment_boxes(shipment_id);

-- WHERE sb.barcode = $1 (shipment.controller - getBoxByBarcode)
CREATE INDEX IF NOT EXISTS idx_shipment_boxes_barcode
  ON shipment_boxes(barcode);

-- WHERE sb.shipment_id = $1 AND sb.destination = $2 (shipment.controller correlated subquery)
CREATE INDEX IF NOT EXISTS idx_shipment_boxes_shipment_dest
  ON shipment_boxes(shipment_id, destination);

-- ORDER BY box_number (shipment.controller)
CREATE INDEX IF NOT EXISTS idx_shipment_boxes_order
  ON shipment_boxes(shipment_id, box_number);

-- ============================================
-- SHIPMENT BOX CONTENTS TABLE
-- ============================================

-- WHERE sbc.box_id = $1 (shipment.controller - getBoxByBarcode, getShipmentBoxes)
CREATE INDEX IF NOT EXISTS idx_shipment_box_contents_box
  ON shipment_box_contents(box_id);

-- WHERE box_id = $1 AND product_sku = $2 (shipment.controller - addItemToBox upsert)
CREATE INDEX IF NOT EXISTS idx_shipment_box_contents_box_sku
  ON shipment_box_contents(box_id, product_sku);

-- ============================================
-- CYCLE COUNT SESSIONS TABLE
-- ============================================

-- WHERE s.warehouse_id = $1 (cyclecount.controller - getAllSessions)
CREATE INDEX IF NOT EXISTS idx_cycle_count_sessions_warehouse
  ON cycle_count_sessions(warehouse_id);

-- WHERE s.status = $1 (cyclecount.controller - getAllSessions)
CREATE INDEX IF NOT EXISTS idx_cycle_count_sessions_status
  ON cycle_count_sessions(status);

-- ORDER BY s.created_at DESC (cyclecount.controller - getAllSessions)
CREATE INDEX IF NOT EXISTS idx_cycle_count_sessions_created_desc
  ON cycle_count_sessions(created_at DESC);

-- ============================================
-- CYCLE COUNT ITEMS TABLE
-- ============================================

-- WHERE i.session_id = $1 (cyclecount.controller - getSessionById, completeSession)
CREATE INDEX IF NOT EXISTS idx_cycle_count_items_session
  ON cycle_count_items(session_id);

-- WHERE session_id = $1 AND status = 'COUNTED' AND variance != 0 (cyclecount.controller - completeSession)
CREATE INDEX IF NOT EXISTS idx_cycle_count_items_session_counted
  ON cycle_count_items(session_id) WHERE status = 'COUNTED' AND variance != 0;

-- ============================================
-- CYCLE COUNT ADJUSTMENTS TABLE
-- ============================================

-- WHERE session_id (cyclecount.controller - completeSession inserts)
CREATE INDEX IF NOT EXISTS idx_cycle_count_adjustments_session
  ON cycle_count_adjustments(session_id);

-- ============================================
-- RMA REQUESTS TABLE
-- ============================================

-- WHERE r.warehouse_id = $1 (rma.controller - getAllRMAs)
CREATE INDEX IF NOT EXISTS idx_rma_requests_warehouse
  ON rma_requests(warehouse_id);

-- WHERE r.status = $1 (rma.controller - getAllRMAs)
CREATE INDEX IF NOT EXISTS idx_rma_requests_status
  ON rma_requests(status);

-- ORDER BY r.created_at DESC (rma.controller - getAllRMAs)
CREATE INDEX IF NOT EXISTS idx_rma_requests_created_desc
  ON rma_requests(created_at DESC);

-- ============================================
-- RMA ITEMS TABLE
-- ============================================

-- WHERE i.rma_id = $1 (rma.controller - getRMAById)
CREATE INDEX IF NOT EXISTS idx_rma_items_rma
  ON rma_items(rma_id);

-- ============================================
-- RMA HISTORY TABLE
-- ============================================

-- WHERE rma_id = $1 ORDER BY created_at DESC (rma.controller - getRMAById)
CREATE INDEX IF NOT EXISTS idx_rma_history_rma
  ON rma_history(rma_id, created_at DESC);

-- ============================================
-- RETURN RECEIPTS TABLE
-- ============================================

-- WHERE rma_id = $1 (rma.controller - receiveReturn inserts)
CREATE INDEX IF NOT EXISTS idx_return_receipts_rma
  ON return_receipts(rma_id);

-- ============================================
-- COUNT REPORTS TABLE
-- ============================================

-- WHERE cr.warehouse_id = $1 (report.controller - getAllCountReports)
CREATE INDEX IF NOT EXISTS idx_count_reports_warehouse
  ON count_reports(warehouse_id);

-- WHERE cr.report_date (report.controller - getAllCountReports date range)
CREATE INDEX IF NOT EXISTS idx_count_reports_date
  ON count_reports(report_date DESC);

-- ORDER BY cr.report_date DESC, cr.created_at DESC (report.controller)
CREATE INDEX IF NOT EXISTS idx_count_reports_date_created
  ON count_reports(report_date DESC, created_at DESC);

-- ============================================
-- COUNT REPORT LOCATIONS TABLE
-- ============================================

-- WHERE report_id = $1 (report.controller - getCountReportById)
CREATE INDEX IF NOT EXISTS idx_count_report_locations_report
  ON count_report_locations(report_id);

-- ============================================
-- COUNT REPORT ITEMS TABLE
-- ============================================

-- WHERE report_location_id = $1 (report.controller - getCountReportById)
CREATE INDEX IF NOT EXISTS idx_count_report_items_location
  ON count_report_items(report_location_id);

-- WHERE report_id = $1 (cascading deletes / lookups)
CREATE INDEX IF NOT EXISTS idx_count_report_items_report
  ON count_report_items(report_id);

-- ============================================
-- WMS USERS TABLE
-- ============================================

-- WHERE u.username = $1 (user.controller - createUser duplicate check, auth.controller)
CREATE INDEX IF NOT EXISTS idx_wms_users_username
  ON wms_users(username);

-- WHERE u.email = $1 (user.controller - createUser, auth.controller - googleLogin)
CREATE INDEX IF NOT EXISTS idx_wms_users_email
  ON wms_users(email);

-- WHERE u.warehouse_id = $1 (user.controller - getAllUsers filter)
CREATE INDEX IF NOT EXISTS idx_wms_users_warehouse
  ON wms_users(warehouse_id);

-- WHERE u.role = $1 (user.controller - getAllUsers filter)
CREATE INDEX IF NOT EXISTS idx_wms_users_role
  ON wms_users(role);

-- WHERE u.is_active = $1 (user.controller, auth.controller)
CREATE INDEX IF NOT EXISTS idx_wms_users_active
  ON wms_users(is_active);

-- ============================================
-- USER PERMISSIONS TABLE
-- ============================================

-- WHERE up.user_id = $1 (user.controller - getUserById, updateUser; auth.controller - getProfile)
CREATE INDEX IF NOT EXISTS idx_user_permissions_user
  ON user_permissions(user_id);

-- ============================================
-- REFRESH TOKENS TABLE
-- ============================================

-- WHERE rt.user_id = $1 AND rt.is_revoked = false (auth.controller - refreshAccessToken, logout)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
  ON refresh_tokens(user_id) WHERE is_revoked = false;

-- ============================================
-- DEVICE SESSIONS TABLE
-- ============================================

-- WHERE user_id = $1 AND is_active = true (auth.controller, user.controller - deleteUser)
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_active
  ON device_sessions(user_id) WHERE is_active = true;

-- ============================================
-- DEVICES TABLE
-- ============================================

-- WHERE device_uuid = $1 (auth.controller - googleLogin)
CREATE INDEX IF NOT EXISTS idx_devices_uuid
  ON devices(device_uuid);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================

-- WHERE user_id = $1 ORDER BY created_at DESC (user.controller - getUserAuditLogs)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON audit_logs(user_id, created_at DESC);
