export type QueryMode = 'SKU' | 'LOCATION' | 'SERIAL' | 'CONTAINER';

export interface LocationInventoryItem {
  sku_code: string;
  product_name: string;
  quantity_each: number;
  quantity_box: number;
  quantity_pallet: number;
}

export interface SKUInventoryItem {
  location_code: string;
  zone: string;
  quantity_each: number;
  quantity_box: number;
  quantity_pallet: number;
}

export interface SerialHistoryEvent {
  history_id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  from_location: string | null;
  to_location: string | null;
  from_warehouse: string | null;
  to_warehouse: string | null;
  performed_by: string | null;
  session_mode: string | null;
  notes: string | null;
  created_at: string;
}

export interface SerialInfo {
  serial_id: number;
  full_barcode: string;
  sku_code: string;
  serial_no: string;
  product_name: string;
  status: string;
  created_at: string;
  last_scanned_at: string | null;
}

export interface SerialHistoryData {
  serial: SerialInfo;
  history: SerialHistoryEvent[];
  scan_operations: Array<{ operation_id: number; operation_type: string; scanned_at: string }>;
}

export interface ContainerContent {
  sku_code: string;
  product_name: string;
  product_barcode: string;
  quantity: number;
}

export interface ContainerData {
  container: {
    container_id: number;
    barcode: string;
    container_type: 'BOX' | 'PALLET';
    warehouse_id: number;
    location_id: number | null;
    status: string;
    created_by: string;
    created_at: string;
    opened_at: string | null;
    notes: string | null;
  };
  contents: ContainerContent[];
}

export const zoneTagClasses: Record<string, string> = {
  picking: 'bg-primary-100 text-primary-700',
  storage: 'bg-success-100 text-success-700',
  receiving: 'bg-warning-100 text-warning-700',
  shipping: 'bg-info-100 text-info-700',
};

export const serialStatusClasses: Record<string, string> = {
  AVAILABLE: 'bg-primary-100 text-primary-700',
  IN_STOCK: 'bg-success-100 text-success-700',
  SHIPPED: 'bg-info-100 text-info-700',
  USED: 'bg-error-100 text-error-700',
};

export const containerStatusClasses: Record<string, string> = {
  active: 'bg-success-500',
  opened: 'bg-primary-500',
  closed: 'bg-slate-500',
};
