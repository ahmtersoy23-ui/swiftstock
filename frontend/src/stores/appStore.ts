import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// APP STORE - Uygulama geneli state yönetimi
// ============================================
// Bu store, kimlik doğrulama dışındaki tüm uygulama
// state'lerini yönetir. Kimlik için ssoStore kullanılır.

interface PendingTransactionItem {
  sku_code?: string;
  barcode?: string;
  product_name?: string;
  quantity: number;
  unit_type: 'EACH' | 'BOX' | 'PALLET';
}

interface AppState {
  // Ayarlar (persist edilir)
  currentWarehouse: string;
  language: 'tr' | 'en';
  setCurrentWarehouse: (warehouse: string) => void;
  setLanguage: (language: 'tr' | 'en') => void;

  // Tarama state'i
  lastScannedBarcode: string | null;
  setLastScannedBarcode: (barcode: string | null) => void;

  // Bekleyen işlem state'i (operasyonlar sayfası için)
  pendingTransaction: {
    type: 'IN' | 'OUT' | null;
    items: PendingTransactionItem[];
  };
  addItemToTransaction: (item: PendingTransactionItem) => void;
  removeItemFromTransaction: (index: number) => void;
  clearTransaction: () => void;
  setTransactionType: (type: 'IN' | 'OUT') => void;

  // UI state'i
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Varsayılan değerler
      currentWarehouse: 'TUR',
      language: 'tr',
      lastScannedBarcode: null,

      pendingTransaction: {
        type: null,
        items: [],
      },

      isLoading: false,
      error: null,

      // Ayar aksiyonları
      setCurrentWarehouse: (warehouse) => set({ currentWarehouse: warehouse }),
      setLanguage: (language) => set({ language }),
      setLastScannedBarcode: (barcode) => set({ lastScannedBarcode: barcode }),

      // İşlem aksiyonları
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

      // UI aksiyonları
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'wms-app-storage',
      // Sadece ayarları persist et, geçici state'leri değil
      partialize: (state) => ({
        currentWarehouse: state.currentWarehouse,
        language: state.language,
      }),
    }
  )
);

// Geriye uyumluluk için alias (eski kodlar çalışmaya devam etsin)
export const useAppStore = useStore;
