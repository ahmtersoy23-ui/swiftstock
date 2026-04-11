import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useStore } from '../stores/appStore';
import { translations } from '../i18n/translations';

interface TransactionWithDetails {
  transaction_id: number;
  transaction_uuid: string;
  transaction_type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
  warehouse_id: number;
  warehouse_code: string;
  location_id?: number;
  location_code?: string;
  product_sku?: string;
  total_quantity?: number;
  reference_no?: string;
  notes?: string;
  created_by: string;
  created_at: Date;
  item_count: number;
}

interface TransactionItem {
  item_id: number;
  sku_code: string;
  product_name: string;
  barcode: string;
  quantity: number;
  unit_type: string;
  quantity_each: number;
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'last7' | 'last30';
type TypeFilter = 'all' | 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';

function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<TransactionItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [skuFilter, setSkuFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const { language } = useStore();
  const t = translations[language];

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, dateFilter, typeFilter, skuFilter, locationFilter]);

  const loadTransactions = async () => {
    try {
      const response = await apiClient.getRecentTransactions(100);
      if (response.success && response.data) {
        setTransactions(response.data as TransactionWithDetails[]);
      }
    } catch {
      setError(t.failedToLoadTransactions);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(txn => txn.transaction_type === typeFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 7);
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 30);

      filtered = filtered.filter(txn => {
        const txnDate = new Date(txn.created_at);
        switch (dateFilter) {
          case 'today':
            return txnDate >= today;
          case 'yesterday':
            return txnDate >= yesterday && txnDate < today;
          case 'last7':
            return txnDate >= last7;
          case 'last30':
            return txnDate >= last30;
          default:
            return true;
        }
      });
    }

    // Location filter
    if (locationFilter.trim()) {
      filtered = filtered.filter(txn =>
        txn.location_code?.toLowerCase().includes(locationFilter.toLowerCase().trim())
      );
    }

    setFilteredTransactions(filtered);
  };

  // SKU filter needs to work on transaction items, so we need to load all items
  const [allTransactionItems, setAllTransactionItems] = useState<Map<number, TransactionItem[]>>(new Map());
  const [loadingSkuFilter, setLoadingSkuFilter] = useState(false);

  // Load transaction items when SKU filter is applied
  useEffect(() => {
    const loadItemsForSkuFilter = async () => {
      if (!skuFilter.trim()) {
        setAllTransactionItems(new Map());
        return;
      }

      setLoadingSkuFilter(true);
      const itemsMap = new Map<number, TransactionItem[]>();

      for (const txn of transactions) {
        try {
          const response = await apiClient.getTransactionDetails(txn.transaction_id);
          if (response.success && response.data?.items) {
            itemsMap.set(txn.transaction_id, response.data.items);
          }
        } catch {
          // Continue with other transactions
        }
      }

      setAllTransactionItems(itemsMap);
      setLoadingSkuFilter(false);
    };

    if (skuFilter.trim() && transactions.length > 0) {
      loadItemsForSkuFilter();
    }
  }, [skuFilter, transactions]);

  // Apply SKU filter to filteredTransactions
  const displayedTransactions = skuFilter.trim()
    ? filteredTransactions.filter(txn => {
        const items = allTransactionItems.get(txn.transaction_id) || [];
        return items.some(item =>
          item.sku_code?.toLowerCase().includes(skuFilter.toLowerCase().trim()) ||
          item.product_name?.toLowerCase().includes(skuFilter.toLowerCase().trim())
        );
      })
    : filteredTransactions;

  const clearAllFilters = () => {
    setDateFilter('all');
    setTypeFilter('all');
    setSkuFilter('');
    setLocationFilter('');
  };

  const hasActiveFilters = dateFilter !== 'all' || typeFilter !== 'all' || skuFilter.trim() || locationFilter.trim();

  const loadTransactionItems = async (transactionId: number) => {
    if (expandedId === transactionId) {
      setExpandedId(null);
      setExpandedItems([]);
      return;
    }

    setLoadingItems(true);
    try {
      const response = await apiClient.getTransactionDetails(transactionId);
      if (response.success && response.data) {
        setExpandedItems(response.data.items || []);
        setExpandedId(transactionId);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const formatDate = (dateString: Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, Record<string, string>> = {
      tr: { IN: 'GİRİŞ', OUT: 'ÇIKIŞ', ADJUST: 'DÜZELTME', TRANSFER: 'TRANSFER' },
      en: { IN: 'IN', OUT: 'OUT', ADJUST: 'ADJUST', TRANSFER: 'TRANSFER' },
    };
    return labels[language]?.[type] || type;
  };

  const getTypeBadgeClass = (type: string) => {
    const classes: Record<string, string> = {
      IN: 'bg-green-100 text-green-800',
      OUT: 'bg-red-100 text-red-800',
      ADJUST: 'bg-amber-100 text-amber-800',
      TRANSFER: 'bg-blue-100 text-blue-800',
    };
    return classes[type] || 'bg-slate-100 text-slate-600';
  };

  const getFilterBtnActiveClass = (type: string) => {
    const classes: Record<string, string> = {
      IN: 'bg-emerald-500 border-emerald-500 text-white',
      OUT: 'bg-red-500 border-red-500 text-white',
      TRANSFER: 'bg-blue-500 border-blue-500 text-white',
      ADJUST: 'bg-amber-500 border-amber-500 text-white',
    };
    return classes[type] || 'bg-blue-500 border-blue-500 text-white';
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4 max-sm:p-2">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl max-sm:rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 max-sm:p-4 bg-gradient-to-br from-blue-500 to-blue-700 text-white">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-[1.125rem] cursor-pointer flex items-center justify-center transition-colors duration-200 hover:bg-white/30" onClick={() => navigate('/')}>
            ←
          </button>
          <h2 className="m-0 text-xl max-sm:text-[1.1rem] font-bold text-white flex-1">{t.transactionHistory}</h2>
          <button onClick={() => {
            if (filteredTransactions.length === 0) return;
            import('../utils/exportXlsx').then(({ exportToXlsx }) => {
              exportToXlsx(
                filteredTransactions.map(tx => ({
                  ID: tx.transaction_id,
                  Type: tx.transaction_type,
                  Warehouse: tx.warehouse_code,
                  SKU: tx.product_sku || '',
                  Quantity: tx.total_quantity,
                  Location: tx.location_code || '',
                  Reference: tx.reference_no || '',
                  Date: new Date(tx.created_at).toLocaleString(),
                  User: tx.created_by,
                })),
                `transactions-${new Date().toISOString().slice(0, 10)}`,
                'Transactions',
              );
            });
          }} className="px-4 py-2 bg-white/20 text-white border-none rounded-lg text-[0.9rem] font-semibold cursor-pointer transition-colors duration-200 hover:bg-white/30 disabled:opacity-60 disabled:cursor-not-allowed" disabled={filteredTransactions.length === 0} title="Export XLSX">
            ↓ XLSX
          </button>
          <button onClick={loadTransactions} className="px-4 py-2 bg-white/20 text-white border-none rounded-lg text-[0.9rem] font-semibold cursor-pointer transition-colors duration-200 hover:bg-white/30 disabled:opacity-60 disabled:cursor-not-allowed" disabled={loading}>
            🔄 {t.refresh}
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 max-sm:p-3 bg-slate-50 border-b border-slate-200">
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t.filterByType}</label>
            <div className="flex gap-2 flex-wrap">
              <button
                className={`px-3 py-2 max-sm:px-2.5 max-sm:py-1.5 rounded-md text-[0.8rem] max-sm:text-xs font-medium cursor-pointer transition-all duration-200 ${typeFilter === 'all' ? 'bg-blue-500 border-blue-500 text-white border' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-500'}`}
                onClick={() => setTypeFilter('all')}
              >
                {t.allTypes}
              </button>
              {(['IN', 'OUT', 'TRANSFER', 'ADJUST'] as TypeFilter[]).map(type => (
                <button
                  key={type}
                  className={`px-3 py-2 max-sm:px-2.5 max-sm:py-1.5 rounded-md text-[0.8rem] max-sm:text-xs font-medium cursor-pointer transition-all duration-200 ${typeFilter === type ? getFilterBtnActiveClass(type) + ' border' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-500'}`}
                  onClick={() => setTypeFilter(type)}
                >
                  {type === 'IN' ? t.in : type === 'OUT' ? t.out : type === 'TRANSFER' ? t.transfer : t.adjust}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t.filterByDate}</label>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'today', 'yesterday', 'last7', 'last30'] as DateFilter[]).map(df => (
                <button
                  key={df}
                  className={`px-3 py-2 max-sm:px-2.5 max-sm:py-1.5 rounded-md text-[0.8rem] max-sm:text-xs font-medium cursor-pointer transition-all duration-200 ${dateFilter === df ? 'bg-blue-500 border-blue-500 text-white border' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-500'}`}
                  onClick={() => setDateFilter(df)}
                >
                  {df === 'all' ? t.allTime : df === 'today' ? t.today : df === 'yesterday' ? t.yesterday : df === 'last7' ? t.last7Days : t.last30Days}
                </button>
              ))}
            </div>
          </div>

          {/* SKU and Location Filters */}
          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3 mt-3">
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t.filterBySKU}</label>
              <input
                type="text"
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                placeholder={t.skuPlaceholder}
                className="px-3 py-2.5 max-sm:px-2.5 max-sm:py-2 border border-slate-200 rounded-md text-[0.85rem] max-sm:text-[0.8rem] transition-all duration-200 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t.filterByLocation}</label>
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder={t.locationPlaceholder}
                className="px-3 py-2.5 max-sm:px-2.5 max-sm:py-2 border border-slate-200 rounded-md text-[0.85rem] max-sm:text-[0.8rem] transition-all duration-200 focus:outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 max-sm:flex-col max-sm:gap-2 max-sm:items-stretch">
            <div className="text-[0.85rem] text-slate-500 max-sm:text-center">
              {loadingSkuFilter && <span className="inline-block mr-2 animate-pulse">...</span>}
              {displayedTransactions.length} / {transactions.length} {t.items}
            </div>
            {hasActiveFilters && (
              <button className="px-3 py-1.5 max-sm:w-full max-sm:py-2 bg-red-500 text-white border-none rounded-md text-[0.8rem] font-semibold cursor-pointer transition-colors duration-200 hover:bg-red-600" onClick={clearAllFilters}>
                {t.clearFilters}
              </button>
            )}
          </div>
        </div>

        {loading && <div className="text-center py-12 px-4 text-gray-500">{t.loadingTransactions}</div>}
        {error && <div className="bg-red-100 text-red-800 p-4 m-4 rounded-lg text-center">{error}</div>}

        {!loading && !error && displayedTransactions.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto">
            {displayedTransactions.map((txn) => (
              <div key={txn.transaction_id}>
                <div
                  className={`p-4 max-sm:p-3 border-b border-slate-100 cursor-pointer transition-colors duration-150 hover:bg-slate-50 ${expandedId === txn.transaction_id ? 'bg-blue-50' : ''}`}
                  onClick={() => loadTransactionItems(txn.transaction_id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-2.5 max-sm:px-2 py-1.5 max-sm:py-1 rounded-md text-[0.7rem] max-sm:text-[0.65rem] font-bold uppercase tracking-wide min-w-[70px] max-sm:min-w-[60px] text-center ${getTypeBadgeClass(txn.transaction_type)}`}>
                      {getTypeLabel(txn.transaction_type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-teal-600 text-[0.95rem] max-sm:text-[0.85rem]">{txn.location_code || '-'}</div>
                      <div className="flex gap-3 mt-1 max-sm:flex-col max-sm:gap-0.5">
                        <span className="text-[0.8rem] text-slate-500">{formatDate(txn.created_at)}</span>
                        <span className="text-[0.8rem] text-slate-400">{txn.created_by}</span>
                      </div>
                    </div>
                    <div className="font-bold text-blue-500 text-[0.95rem] whitespace-nowrap">{txn.item_count} {t.items}</div>
                  </div>
                  {txn.notes && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200 text-[0.85rem] text-slate-500 italic">{txn.notes}</div>
                  )}
                </div>

                {expandedId === txn.transaction_id && (
                  <div className="px-4 max-sm:px-2 pb-4 pt-3 bg-slate-50">
                    {loadingItems ? (
                      <div className="text-center p-4 text-gray-500 text-[0.9rem]">{t.loadingItems}</div>
                    ) : expandedItems.length > 0 ? (
                      <div className="bg-white rounded-[10px] p-4 max-sm:p-3 shadow-sm">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                          <span className="font-semibold text-gray-800 text-[0.95rem]">{t.transactionDetails}</span>
                          <span className="text-[0.8rem] text-gray-500 font-mono">#{txn.transaction_id}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {expandedItems.map((item) => (
                            <div key={item.item_id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-gray-800 text-[0.9rem]">{item.product_name}</span>
                                <span className="font-mono text-xs text-gray-500">{item.sku_code}</span>
                              </div>
                              <span className="font-bold text-emerald-600 text-[0.95rem]">{item.quantity_each} {t.each}</span>
                            </div>
                          ))}
                        </div>
                        {txn.reference_no && (
                          <div className="text-[0.85rem] text-gray-500 pt-3 mt-3 border-t border-gray-200">
                            {t.reference}: <strong>{txn.reference_no}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center p-4 text-gray-500 text-[0.9rem]">{t.noItemsFound}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && displayedTransactions.length === 0 && (
          <div className="text-center py-12 px-4 text-gray-500">
            <div className="text-5xl mb-4">📋</div>
            <p>{t.noTransactionsFound}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Transactions;
