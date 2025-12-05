import { create } from 'zustand';
import type { Product, Transaction, InventorySummary } from '../types';

interface AppState {
  // User state
  currentUser: string;
  currentWarehouse: string;
  language: 'tr' | 'en';
  setCurrentUser: (user: string) => void;
  setCurrentWarehouse: (warehouse: string) => void;
  setLanguage: (language: 'tr' | 'en') => void;

  // Scan state
  lastScannedBarcode: string | null;
  setLastScannedBarcode: (barcode: string | null) => void;

  // Transaction state
  pendingTransaction: {
    type: 'IN' | 'OUT' | null;
    items: Array<{
      sku_code?: string;
      barcode?: string;
      product_name?: string;
      quantity: number;
      unit_type: 'EACH' | 'BOX' | 'PALLET';
    }>;
  };
  addItemToTransaction: (item: any) => void;
  removeItemFromTransaction: (index: number) => void;
  clearTransaction: () => void;
  setTransactionType: (type: 'IN' | 'OUT') => void;

  // Data cache
  products: Product[];
  transactions: Transaction[];
  inventory: InventorySummary[];
  setProducts: (products: Product[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setInventory: (inventory: InventorySummary[]) => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  currentUser: 'admin',
  currentWarehouse: 'USA',
  language: 'tr',
  lastScannedBarcode: null,

  pendingTransaction: {
    type: null,
    items: [],
  },

  products: [],
  transactions: [],
  inventory: [],

  isLoading: false,
  error: null,

  // Actions
  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentWarehouse: (warehouse) => set({ currentWarehouse: warehouse }),
  setLanguage: (language) => set({ language }),
  setLastScannedBarcode: (barcode) => set({ lastScannedBarcode: barcode }),

  addItemToTransaction: (item) =>
    set((state) => ({
      pendingTransaction: {
        ...state.pendingTransaction,
        items: [...state.pendingTransaction.items, item],
      },
    })),

  removeItemFromTransaction: (index) =>
    set((state) => ({
      pendingTransaction: {
        ...state.pendingTransaction,
        items: state.pendingTransaction.items.filter((_, i) => i !== index),
      },
    })),

  clearTransaction: () =>
    set({
      pendingTransaction: {
        type: null,
        items: [],
      },
    }),

  setTransactionType: (type) =>
    set((state) => ({
      pendingTransaction: {
        ...state.pendingTransaction,
        type,
      },
    })),

  setProducts: (products) => set({ products }),
  setTransactions: (transactions) => set({ transactions }),
  setInventory: (inventory) => set({ inventory }),

  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
