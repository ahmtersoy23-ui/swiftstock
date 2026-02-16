// Types for Operations page
import type { Product, Location, OperationMode } from '../../types';

export type WorkflowStep = 'IDLE' | 'MODE_SELECTED' | 'LOCATION_SET' | 'SCANNING';

export interface ScannedItem {
  product: Product;
  serial?: { serial_no: string; full_barcode: string; status: string };
  fromContainer?: string;
}

export interface WorkflowState {
  step: WorkflowStep;
  mode: OperationMode | null;
  location: Location | null;
  items: ScannedItem[];
}

export interface CountItem {
  sku_code: string;
  product_name: string;
  expected_quantity: number;
  counted_quantity: number;
  variance: number;
  scanned_barcodes: string[];
}

export interface CountLocationResult {
  location: Location;
  items: CountItem[];
  unexpectedItems: CountItem[];
  totalExpected: number;
  totalCounted: number;
  totalVariance: number;
}

export interface CountState {
  isActive: boolean;
  currentLocationItems: CountItem[];
  unexpectedItems: CountItem[];
  completedLocations: CountLocationResult[];
  showSummary: boolean;
}

export const initialWorkflowState: WorkflowState = {
  step: 'IDLE',
  mode: null,
  location: null,
  items: [],
};

export const initialCountState: CountState = {
  isActive: false,
  currentLocationItems: [],
  unexpectedItems: [],
  completedLocations: [],
  showSummary: false,
};
