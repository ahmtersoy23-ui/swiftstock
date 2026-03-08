import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/appStore';
import api, { serialApi } from '../lib/api';
import type { Product } from '../types';
import { translations } from '../i18n/translations';
import './Products.css';

function Products() {
  const navigate = useNavigate();
  const { language, currentWarehouse } = useStore();
  const t = translations[language];
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [allCategories, setAllCategories] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [pageSize] = useState(100);
  const [searchDebounce, setSearchDebounce] = useState('');

  // Label print modal state
  const [labelModal, setLabelModal] = useState<{
    product: Product | null;
    quantity: number;
    loading: boolean;
  }>({ product: null, quantity: 1, loading: false });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(search);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter]);

  // Load products when page, search, or filters change
  useEffect(() => {
    loadProducts();
  }, [currentPage, searchDebounce, categoryFilter]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/products?page=${currentPage}&limit=${pageSize}&search=${searchDebounce}`;
      if (categoryFilter) {
        url += `&category=${encodeURIComponent(categoryFilter)}`;
      }

      const response = await api.get(url);
      const data = response.data;

      if (data.success && data.data) {
        if (allCategories.length === 0) {
          const allResponse = await api.get('/products?page=1&limit=10000');
          if (allResponse.data.success && allResponse.data.data) {
            const categories = Array.from(
              new Set(
                allResponse.data.data
                  .map((p: Product) => p.category)
                  .filter((c: string | undefined) => c && c.trim() !== '')
              )
            ).sort() as string[];
            setAllCategories(categories);
          }
        }

        setProducts(data.data);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
          setTotalProducts(data.pagination.total);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Opens the label quantity modal
  const handlePrintLabel = (product: Product) => {
    setLabelModal({ product, quantity: 1, loading: false });
  };

  // Generates serials via API, then opens print popup
  const handleGenerateLabels = async () => {
    if (!labelModal.product) return;
    setLabelModal((prev) => ({ ...prev, loading: true }));
    try {
      const result = await serialApi.generate(labelModal.product.sku_code, labelModal.quantity);
      if (!result.success) throw new Error((result as { error?: string }).error || 'Seri numarasi olusturulamadi');
      const serials = (result as { data: { serials: Array<{ full_barcode: string }> } }).data.serials;
      setLabelModal({ product: null, quantity: 1, loading: false });
      openPrintPopup(labelModal.product, serials);
    } catch (err) {
      setError((err as Error).message);
      setLabelModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Opens print popup and renders labels from pre-fetched serial data
  const openPrintPopup = (product: Product, serials: Array<{ full_barcode: string }>) => {
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>Etiket Yazdir</title>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
      .controls { background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; text-align: center; }
      .controls h2 { margin-bottom: 8px; color: #2563eb; }
      .btn { padding: 12px 24px; margin: 4px; cursor: pointer; font-size: 15px; border: none; border-radius: 6px; font-weight: 600; }
      .btn-print { background: #2563eb; color: white; }
      .btn-close { background: #6b7280; color: white; }
      .labels-container { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-start; padding: 16px; background: white; border-radius: 8px; }
      .label { width: 100mm; height: 30mm; border: 1px dashed #999; padding: 1mm 2mm; background: white;
        display: flex; flex-direction: column; align-items: center; justify-content: space-between; page-break-inside: avoid; }
      .product-name { font-size: 8pt; font-weight: bold; line-height: 1.2; text-align: center;
        width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .barcode-container { width: 96mm; height: 14mm; display: flex; align-items: center; justify-content: center; }
      .barcode-container svg { max-width: 100%; max-height: 100%; }
      .serial-code { font-size: 6pt; font-family: 'Courier New', monospace; color: #333; text-align: center; }
      @media print {
        body { padding: 0; background: white; }
        .controls { display: none !important; }
        .labels-container { padding: 0; background: transparent; }
        .label { border: none; }
        @page { size: auto; margin: 5mm; }
      }
    </style>
  </head>
  <body>
    <div class="controls">
      <h2 id="title-text"></h2>
      <button class="btn btn-print" onclick="window.print()">Yazdir</button>
      <button class="btn btn-close" onclick="window.close()">Kapat</button>
    </div>
    <div class="labels-container" id="labels-container"></div>
  </body>
</html>`);
    printWindow.document.close();

    printWindow.addEventListener('load', () => {
      const win = printWindow as Window & {
        JsBarcode: (selector: string, value: string, options: object) => void;
      };

      const titleEl = printWindow.document.getElementById('title-text');
      if (titleEl) titleEl.textContent = `${serials.length} Etiket — ${product.sku_code}`;

      const container = printWindow.document.getElementById('labels-container');
      if (!container) return;

      serials.forEach((s, i) => {
        const label = printWindow.document.createElement('div');
        label.className = 'label';

        const nameDiv = printWindow.document.createElement('div');
        nameDiv.className = 'product-name';
        nameDiv.textContent = product.product_name;
        label.appendChild(nameDiv);

        const barcodeDiv = printWindow.document.createElement('div');
        barcodeDiv.className = 'barcode-container';
        const svg = printWindow.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('id', `barcode-${i}`);
        barcodeDiv.appendChild(svg);
        label.appendChild(barcodeDiv);

        const serialDiv = printWindow.document.createElement('div');
        serialDiv.className = 'serial-code';
        serialDiv.textContent = s.full_barcode;
        label.appendChild(serialDiv);

        container.appendChild(label);
      });

      serials.forEach((s, i) => {
        win.JsBarcode?.(`#barcode-${i}`, s.full_barcode, {
          format: 'CODE128', width: 2.2, height: 55, displayValue: false, margin: 0,
        });
      });
    });
  };

  return (
    <div className="products-page">
      <div className="products-card">
        {/* Header */}
        <div className="products-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            ←
          </button>
          <h2>{t.productsCatalog}</h2>
          <div className="warehouse-badge">{currentWarehouse}</div>
        </div>

        {/* Content */}
        <div className="products-content">
          <div className="header-actions">
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="filter-select"
              title={t.filterByCategory}
            >
              <option value="">{t.allCategories}</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="products-stats">
            <span>{totalProducts.toLocaleString()} {t.total}</span>
          </div>

          {error && <div className="error">❌ {error}</div>}

          {loading && <div className="loading">{t.loadingProducts}</div>}

          {!loading && !error && products.length > 0 && (
            <>
              {/* Card View */}
              <div className="products-cards">
                {products.map((product) => (
                  <div key={product.sku_code} className="product-card">
                    <div className="card-header">
                      <span className="card-sku">{product.sku_code}</span>
                      {product.category && <span className="card-category">{product.category}</span>}
                    </div>
                    <div className="card-body">
                      <div className="card-name">{product.product_name}</div>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => handlePrintLabel(product)} className="card-btn print">
                        🖨️ {t.printLabel}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="table-footer">
                <div className="footer-info">
                  {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalProducts)} / {totalProducts.toLocaleString()}
                </div>
                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="btn-page"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn-page"
                  >
                    ◀
                  </button>
                  <span className="page-info">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="btn-page"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="btn-page"
                  >
                    ⏭
                  </button>
                </div>
              </div>
            </>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="empty-state">{t.noProductsFound}</div>
          )}
        </div>
      </div>

      {/* Label Print Modal */}
      {labelModal.product && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => !labelModal.loading && setLabelModal({ product: null, quantity: 1, loading: false })}
        >
          <div
            style={{ background: 'white', borderRadius: 12, padding: 28, width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 6, color: '#111' }}>Etiket Bas</h3>
            <p style={{ color: '#6b7280', marginBottom: 4, fontSize: 13 }}>{labelModal.product.sku_code}</p>
            <p style={{ color: '#374151', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>{labelModal.product.product_name}</p>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14 }}>Adet</label>
            <input
              type="number"
              min={1}
              max={500}
              value={labelModal.quantity}
              onChange={(e) => setLabelModal((prev) => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
              onKeyDown={(e) => e.key === 'Enter' && !labelModal.loading && handleGenerateLabels()}
              autoFocus
              style={{ width: '100%', padding: '10px 12px', fontSize: 18, textAlign: 'center', border: '2px solid #e5e7eb', borderRadius: 6, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleGenerateLabels}
                disabled={labelModal.loading}
                style={{ flex: 1, padding: '12px 0', background: labelModal.loading ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: labelModal.loading ? 'not-allowed' : 'pointer', fontSize: 14 }}
              >
                {labelModal.loading ? 'Uretiliyor...' : 'Seri No Uret ve Hazirla'}
              </button>
              <button
                onClick={() => setLabelModal({ product: null, quantity: 1, loading: false })}
                disabled={labelModal.loading}
                style={{ padding: '12px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
              >
                Iptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;
