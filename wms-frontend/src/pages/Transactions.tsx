import { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { useStore } from '../store/useStore';
import { translations } from '../i18n/translations';
import './Transactions.css';

interface TransactionWithDetails {
  transaction_id: number;
  transaction_uuid: string;
  transaction_type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
  warehouse_id: number;
  warehouse_code: string;
  location_id?: number;
  location_code?: string;
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
    } catch (err: any) {
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
        } catch (err) {
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

  const getTypeClass = (type: string) => {
    const classes: Record<string, string> = {
      IN: 'type-in',
      OUT: 'type-out',
      ADJUST: 'type-adjust',
      TRANSFER: 'type-transfer',
    };
    return classes[type] || '';
  };

  return (
    <div className="transactions-page">
      <div className="transactions-card">
        {/* Header */}
        <div className="transactions-header">
          <h2>{t.transactionHistory}</h2>
          <button onClick={loadTransactions} className="refresh-btn" disabled={loading}>
            🔄 {t.refresh}
          </button>
        </div>

        {/* Filters */}
        <div className="filters-section">
          <div className="filter-group">
            <label>{t.filterByType}</label>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${typeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                {t.allTypes}
              </button>
              <button
                className={`filter-btn type-in ${typeFilter === 'IN' ? 'active' : ''}`}
                onClick={() => setTypeFilter('IN')}
              >
                {t.in}
              </button>
              <button
                className={`filter-btn type-out ${typeFilter === 'OUT' ? 'active' : ''}`}
                onClick={() => setTypeFilter('OUT')}
              >
                {t.out}
              </button>
              <button
                className={`filter-btn type-transfer ${typeFilter === 'TRANSFER' ? 'active' : ''}`}
                onClick={() => setTypeFilter('TRANSFER')}
              >
                {t.transfer}
              </button>
              <button
                className={`filter-btn type-adjust ${typeFilter === 'ADJUST' ? 'active' : ''}`}
                onClick={() => setTypeFilter('ADJUST')}
              >
                {t.adjust}
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label>{t.filterByDate}</label>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${dateFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDateFilter('all')}
              >
                {t.allTime}
              </button>
              <button
                className={`filter-btn ${dateFilter === 'today' ? 'active' : ''}`}
                onClick={() => setDateFilter('today')}
              >
                {t.today}
              </button>
              <button
                className={`filter-btn ${dateFilter === 'yesterday' ? 'active' : ''}`}
                onClick={() => setDateFilter('yesterday')}
              >
                {t.yesterday}
              </button>
              <button
                className={`filter-btn ${dateFilter === 'last7' ? 'active' : ''}`}
                onClick={() => setDateFilter('last7')}
              >
                {t.last7Days}
              </button>
              <button
                className={`filter-btn ${dateFilter === 'last30' ? 'active' : ''}`}
                onClick={() => setDateFilter('last30')}
              >
                {t.last30Days}
              </button>
            </div>
          </div>

          {/* SKU and Location Filters */}
          <div className="text-filters">
            <div className="filter-input-group">
              <label>{t.filterBySKU}</label>
              <input
                type="text"
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                placeholder={t.skuPlaceholder}
                className="filter-input"
              />
            </div>
            <div className="filter-input-group">
              <label>{t.filterByLocation}</label>
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder={t.locationPlaceholder}
                className="filter-input"
              />
            </div>
          </div>

          <div className="filter-footer">
            <div className="filter-summary">
              {loadingSkuFilter && <span className="loading-indicator">...</span>}
              {displayedTransactions.length} / {transactions.length} {t.items}
            </div>
            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearAllFilters}>
                {t.clearFilters}
              </button>
            )}
          </div>
        </div>

        {loading && <div className="loading">{t.loadingTransactions}</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && displayedTransactions.length > 0 && (
          <div className="transactions-list">
            {displayedTransactions.map((txn) => (
              <div key={txn.transaction_id}>
                <div
                  className={`transaction-item ${expandedId === txn.transaction_id ? 'expanded' : ''}`}
                  onClick={() => loadTransactionItems(txn.transaction_id)}
                >
                  <div className="txn-main">
                    <span className={`type-badge ${getTypeClass(txn.transaction_type)}`}>
                      {getTypeLabel(txn.transaction_type)}
                    </span>
                    <div className="txn-info">
                      <div className="txn-location">{txn.location_code || '-'}</div>
                      <div className="txn-meta">
                        <span className="txn-date">{formatDate(txn.created_at)}</span>
                        <span className="txn-user">{txn.created_by}</span>
                      </div>
                    </div>
                    <div className="txn-count">{txn.item_count} {t.items}</div>
                  </div>
                  {txn.notes && (
                    <div className="txn-notes">{txn.notes}</div>
                  )}
                </div>

                {expandedId === txn.transaction_id && (
                  <div className="expanded-content">
                    {loadingItems ? (
                      <div className="loading-items">{t.loadingItems}</div>
                    ) : expandedItems.length > 0 ? (
                      <div className="items-detail">
                        <div className="detail-header">
                          <span className="detail-title">{t.transactionDetails}</span>
                          <span className="detail-id">#{txn.transaction_id}</span>
                        </div>
                        <div className="items-list">
                          {expandedItems.map((item) => (
                            <div key={item.item_id} className="item-row">
                              <div className="item-info">
                                <span className="item-name">{item.product_name}</span>
                                <span className="item-sku">{item.sku_code}</span>
                              </div>
                              <span className="item-qty">{item.quantity_each} {t.each}</span>
                            </div>
                          ))}
                        </div>
                        {txn.reference_no && (
                          <div className="detail-ref">
                            {t.reference}: <strong>{txn.reference_no}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="no-items">{t.noItemsFound}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && displayedTransactions.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>{t.noTransactionsFound}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Transactions;
