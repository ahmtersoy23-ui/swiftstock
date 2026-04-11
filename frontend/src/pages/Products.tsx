import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/appStore';
import api, { serialApi } from '../lib/api';
import type { Product } from '../types';
import { Modal, ModalHeader, ModalBody } from '../shared/components/Modal';
import { translations } from '../i18n/translations';

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

  // Label templates
  const LABEL_TEMPLATES = [
    { id: 'standard', name: language === 'tr' ? 'Standart (100x30mm)' : 'Standard (100x30mm)', width: '100mm', height: '30mm', fontSize: '8pt', barcodeH: '14mm', serialSize: '6pt' },
    { id: 'small', name: language === 'tr' ? 'Kucuk (50x25mm)' : 'Small (50x25mm)', width: '50mm', height: '25mm', fontSize: '6pt', barcodeH: '10mm', serialSize: '5pt' },
    { id: 'large', name: language === 'tr' ? 'Buyuk (100x50mm)' : 'Large (100x50mm)', width: '100mm', height: '50mm', fontSize: '10pt', barcodeH: '20mm', serialSize: '7pt' },
  ];

  // Label print modal state
  const [labelModal, setLabelModal] = useState<{
    product: Product | null;
    quantity: number;
    loading: boolean;
    template: string;
  }>({ product: null, quantity: 1, loading: false, template: 'standard' });

  // Bulk selection
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState(1);
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (sku: string) => {
    setSelectedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSkus.size === products.length) {
      setSelectedSkus(new Set());
    } else {
      setSelectedSkus(new Set(products.map(p => p.sku_code)));
    }
  };

  const handleBulkPrint = async () => {
    if (selectedSkus.size === 0) return;
    setBulkLoading(true);
    try {
      const allSerials: Array<{ sku: string; name: string; barcodes: string[] }> = [];
      for (const sku of selectedSkus) {
        const product = products.find(p => p.sku_code === sku);
        if (!product) continue;
        const result = await serialApi.generate(sku, bulkQty);
        const serials = (result as { data: { serials: Array<{ full_barcode: string }> } }).data.serials;
        allSerials.push({
          sku,
          name: product.product_name || product.name || sku,
          barcodes: serials.map(s => s.full_barcode),
        });
      }
      // Open single print popup with all labels
      openBulkPrintPopup(allSerials);
      setBulkMode(false);
      setSelectedSkus(new Set());
    } catch {
      setError('Toplu etiket uretimi basarisiz');
    } finally {
      setBulkLoading(false);
    }
  };

  const openBulkPrintPopup = (items: Array<{ sku: string; name: string; barcodes: string[] }>) => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) return;
    const totalLabels = items.reduce((s, i) => s + i.barcodes.length, 0);
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${totalLabels} Etiket</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js">${'<'}/script>
      <style>
        @page { size: 100mm 30mm; margin: 0; }
        body { margin: 0; padding: 0; }
        .label { width: 100mm; height: 30mm; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: always; padding: 2mm; box-sizing: border-box; }
        .pname { font-size: 7pt; font-family: Arial, sans-serif; text-align: center; max-height: 8mm; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 1mm; }
        svg { max-width: 90mm; height: 14mm; }
        .scode { font-size: 6pt; font-family: 'Courier New', monospace; color: #333; text-align: center; }
      </style></head><body></body></html>`);
    printWindow.document.close();

    const render = () => {
      items.forEach(item => {
        item.barcodes.forEach(bc => {
          const label = printWindow.document.createElement('div');
          label.className = 'label';
          const pname = printWindow.document.createElement('div');
          pname.className = 'pname';
          pname.textContent = item.name;
          label.appendChild(pname);
          const svg = printWindow.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'barcode');
          label.appendChild(svg);
          const scode = printWindow.document.createElement('div');
          scode.className = 'scode';
          scode.textContent = bc;
          label.appendChild(scode);
          printWindow.document.body.appendChild(label);
        });
      });
      const svgs = printWindow.document.querySelectorAll('.barcode');
      const allBarcodes = items.flatMap(i => i.barcodes);
      svgs.forEach((svg, i) => {
        try {
          (printWindow as unknown as { JsBarcode: (el: Element, data: string, opts: object) => void }).JsBarcode(svg, allBarcodes[i], {
            format: 'CODE128', width: 2, height: 40, displayValue: false, margin: 0,
          });
        } catch { /* skip */ }
      });
      setTimeout(() => printWindow.print(), 300);
    };

    if ((printWindow as unknown as { JsBarcode?: unknown }).JsBarcode) {
      render();
    } else {
      printWindow.onload = render;
    }
  };

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
    setLabelModal({ product, quantity: 1, loading: false, template: 'standard' });
  };

  // Generates serials via API, then opens print popup
  const handleGenerateLabels = async () => {
    if (!labelModal.product) return;
    setLabelModal((prev) => ({ ...prev, loading: true }));
    try {
      const result = await serialApi.generate(labelModal.product.sku_code, labelModal.quantity);
      if (!result.success) throw new Error((result as { error?: string }).error || 'Seri numarasi olusturulamadi');
      const serials = (result as { data: { serials: Array<{ full_barcode: string }> } }).data.serials;
      const tpl = LABEL_TEMPLATES.find(t => t.id === labelModal.template) || LABEL_TEMPLATES[0];
      setLabelModal({ product: null, quantity: 1, loading: false, template: 'standard' });
      openPrintPopup(labelModal.product, serials, tpl);
    } catch (err) {
      setError((err as Error).message);
      setLabelModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Opens print popup and renders labels from pre-fetched serial data
  const openPrintPopup = (product: Product, serials: Array<{ full_barcode: string }>, tpl?: { width: string; height: string; fontSize: string; barcodeH: string; serialSize: string }) => {
    const w = tpl?.width || '100mm';
    const h = tpl?.height || '30mm';
    const fs = tpl?.fontSize || '8pt';
    const bh = tpl?.barcodeH || '14mm';
    const ss = tpl?.serialSize || '6pt';
    const barcodeW = parseInt(w) - 4; // mm, with 2mm padding each side

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
      .label { width: ${w}; height: ${h}; border: 1px dashed #999; padding: 1mm 2mm; background: white;
        display: flex; flex-direction: column; align-items: center; justify-content: space-between; page-break-inside: avoid; }
      .product-name { font-size: ${fs}; font-weight: bold; line-height: 1.2; text-align: center;
        width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .barcode-container { width: ${barcodeW}mm; height: ${bh}; display: flex; align-items: center; justify-content: center; }
      .barcode-container svg { max-width: 100%; max-height: 100%; }
      .serial-code { font-size: ${ss}; font-family: 'Courier New', monospace; color: #333; text-align: center; }
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
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4 md:p-2">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 bg-gradient-to-br from-blue-500 to-blue-700 text-white">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-lg cursor-pointer flex items-center justify-center duration-200 hover:bg-white/30" onClick={() => navigate('/')}>
            ←
          </button>
          <h2 className="m-0 text-xl font-bold text-white flex-1">{t.productsCatalog}</h2>
          <button onClick={() => {
            if (products.length === 0) return;
            import('../utils/exportXlsx').then(({ exportToXlsx }) => {
              exportToXlsx(
                products.map(p => ({
                  SKU: p.sku_code || p.product_sku,
                  Name: p.product_name || p.name,
                  Category: p.category || '',
                })),
                `products-${currentWarehouse}-${new Date().toISOString().slice(0, 10)}`,
                'Products',
              );
            });
          }} className="py-1.5 px-3 bg-white/20 text-white border-2 border-white/30 rounded-lg font-semibold cursor-pointer text-xs hover:bg-white/30" disabled={products.length === 0}>
            ↓ XLSX
          </button>
          <div className="py-1.5 px-3 bg-white/20 rounded-md font-semibold text-[0.9rem]">{currentWarehouse}</div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex gap-2 items-center flex-wrap mb-3 md:flex-col md:items-stretch">
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="py-3 px-3 border-2 border-gray-200 rounded-md text-base flex-1 min-w-[200px] focus:outline-none focus:border-blue-600 md:w-full md:min-w-0 md:py-2.5 md:text-[0.9rem]"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-3 px-3 border-2 border-gray-200 rounded-md text-base bg-white cursor-pointer duration-200 min-w-[150px] focus:outline-none focus:border-blue-600 hover:border-gray-400 md:w-full md:min-w-0 md:py-2.5 md:text-[0.9rem]"
              title={t.filterByCategory}
            >
              <option value="">{t.allCategories}</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedSkus(new Set()); }}
              className="py-1.5 px-3 text-xs border-none rounded-md cursor-pointer font-semibold"
              style={{ background: bulkMode ? '#8b5cf6' : '#e2e8f0', color: bulkMode ? 'white' : '#475569' }}
            >
              {bulkMode ? (language === 'tr' ? 'Secimi Kapat' : 'Cancel') : (language === 'tr' ? 'Toplu Etiket' : 'Bulk Labels')}
            </button>
          </div>

          {/* Bulk bar */}
          {bulkMode && (
            <div className="flex items-center gap-2 py-2 flex-wrap">
              <button onClick={toggleSelectAll} className="py-1 px-2.5 text-xs bg-slate-100 border border-slate-200 rounded-md cursor-pointer">
                {selectedSkus.size === products.length ? (language === 'tr' ? 'Secimi Kaldir' : 'Deselect All') : (language === 'tr' ? 'Tumunu Sec' : 'Select All')}
              </button>
              <span className="text-[13px] text-slate-500">
                {selectedSkus.size} {language === 'tr' ? 'secili' : 'selected'}
              </span>
              <input
                type="number"
                value={bulkQty}
                onChange={e => setBulkQty(Math.max(1, Number(e.target.value)))}
                min={1}
                className="w-[60px] py-1 px-2 border border-slate-200 rounded-md text-[13px]"
                title={language === 'tr' ? 'Her SKU icin adet' : 'Qty per SKU'}
              />
              <span className="text-[11px] text-slate-400">{language === 'tr' ? 'adet/SKU' : 'per SKU'}</span>
              <button
                onClick={handleBulkPrint}
                disabled={selectedSkus.size === 0 || bulkLoading}
                className="ml-auto py-1.5 px-4 border-none rounded-md font-semibold text-[13px]"
                style={{ background: selectedSkus.size > 0 ? '#10b981' : '#e2e8f0', color: selectedSkus.size > 0 ? 'white' : '#94a3b8', cursor: selectedSkus.size > 0 ? 'pointer' : 'not-allowed' }}
              >
                {bulkLoading ? '...' : `${selectedSkus.size * bulkQty} ${language === 'tr' ? 'etiket' : 'labels'}`}
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="text-center py-3 bg-blue-50 rounded-lg mb-3 font-semibold text-blue-800">
            <span>{totalProducts.toLocaleString()} {t.total}</span>
          </div>

          {error && <div className="bg-red-100 text-red-800 p-4 rounded-md mb-4 md:text-[0.9rem] md:p-3">{error}</div>}

          {loading && <div className="text-center p-12 text-gray-500 text-lg">{t.loadingProducts}</div>}

          {!loading && !error && products.length > 0 && (
            <>
              {/* Card View */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4 md:grid-cols-1">
                {products.map((product) => (
                  <div
                    key={product.sku_code}
                    className={`relative bg-white rounded-[10px] shadow-[0_2px_4px_rgba(0,0,0,0.08)] overflow-hidden border-2 border-transparent duration-200 hover:shadow-[0_4px_8px_rgba(0,0,0,0.12)] ${bulkMode && selectedSkus.has(product.sku_code) ? 'border-blue-500 bg-blue-50' : ''}`}
                    onClick={bulkMode ? () => toggleSelect(product.sku_code) : undefined}
                    style={bulkMode ? { cursor: 'pointer' } : undefined}
                  >
                    {bulkMode && (
                      <div className="absolute top-2 right-2">
                        <input
                          type="checkbox"
                          checked={selectedSkus.has(product.sku_code)}
                          onChange={() => toggleSelect(product.sku_code)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 cursor-pointer accent-violet-500"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 border-b border-gray-200">
                      <span className="font-mono text-[0.8rem] text-blue-600 font-semibold flex-1">{product.sku_code}</span>
                      {product.category && <span className="text-[0.7rem] bg-green-100 text-green-800 py-0.5 px-2 rounded font-medium">{product.category}</span>}
                    </div>
                    <div className="p-4">
                      <div className="font-semibold text-[0.95rem] text-gray-800 leading-snug mb-2">{product.product_name}</div>
                    </div>
                    {!bulkMode && (
                      <div className="flex border-t border-gray-200">
                        <button onClick={() => handlePrintLabel(product)} className="flex-1 py-3 border-none text-[0.85rem] font-semibold cursor-pointer duration-200 bg-blue-50 text-blue-600 hover:bg-blue-100">
                          {t.printLabel}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="p-4 bg-white rounded-lg mt-4 text-sm text-gray-500 flex justify-between items-center flex-wrap gap-4 shadow-sm md:p-3">
                <div className="md:text-[0.8rem]">
                  {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalProducts)} / {totalProducts.toLocaleString()}
                </div>
                <div className="flex gap-2 items-center md:gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="py-2 px-3 bg-white border border-gray-300 rounded cursor-pointer text-sm duration-200 hover:enabled:bg-gray-100 hover:enabled:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed md:py-2 md:px-3 md:text-[0.85rem]"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="py-2 px-3 bg-white border border-gray-300 rounded cursor-pointer text-sm duration-200 hover:enabled:bg-gray-100 hover:enabled:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed md:py-2 md:px-3 md:text-[0.85rem]"
                  >
                    ◀
                  </button>
                  <span className="px-2 font-semibold text-gray-700 md:text-[0.85rem] md:px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="py-2 px-3 bg-white border border-gray-300 rounded cursor-pointer text-sm duration-200 hover:enabled:bg-gray-100 hover:enabled:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed md:py-2 md:px-3 md:text-[0.85rem]"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="py-2 px-3 bg-white border border-gray-300 rounded cursor-pointer text-sm duration-200 hover:enabled:bg-gray-100 hover:enabled:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed md:py-2 md:px-3 md:text-[0.85rem]"
                  >
                    ⏭
                  </button>
                </div>
              </div>
            </>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="text-center p-12 text-gray-500 text-lg">{t.noProductsFound}</div>
          )}
        </div>
      </div>

      {/* Label Print Modal */}
      <Modal isOpen={!!labelModal.product} onClose={() => !labelModal.loading && setLabelModal({ product: null, quantity: 1, loading: false, template: 'standard' })} size="sm">
        <ModalHeader onClose={() => !labelModal.loading && setLabelModal({ product: null, quantity: 1, loading: false, template: 'standard' })}>Etiket Bas</ModalHeader>
        <ModalBody>
          <p className="text-gray-500 mb-1 text-[13px]">{labelModal.product?.sku_code}</p>
          <p className="text-gray-700 mb-4 text-sm font-medium">{labelModal.product?.product_name}</p>
          <label className="block mb-1.5 font-semibold text-sm">{language === 'tr' ? 'Sablon' : 'Template'}</label>
          <select value={labelModal.template} onChange={(e) => setLabelModal((prev) => ({ ...prev, template: e.target.value }))} className="w-full py-2 px-3 text-sm border-2 border-gray-200 rounded-md mb-3">
            {LABEL_TEMPLATES.map(tpl => (<option key={tpl.id} value={tpl.id}>{tpl.name}</option>))}
          </select>
          <label className="block mb-1.5 font-semibold text-sm">{language === 'tr' ? 'Adet' : 'Quantity'}</label>
          <input type="number" min={1} max={500} value={labelModal.quantity} onChange={(e) => setLabelModal((prev) => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))} onKeyDown={(e) => e.key === 'Enter' && !labelModal.loading && handleGenerateLabels()} autoFocus className="w-full py-2.5 px-3 text-lg text-center border-2 border-gray-200 rounded-md mb-4" />
          <div className="flex gap-2">
            <button onClick={handleGenerateLabels} disabled={labelModal.loading} className="flex-1 py-3 border-none rounded-md font-semibold text-sm text-white" style={{ background: labelModal.loading ? '#9ca3af' : '#10b981', cursor: labelModal.loading ? 'not-allowed' : 'pointer' }}>{labelModal.loading ? 'Uretiliyor...' : 'Seri No Uret ve Hazirla'}</button>
            <button onClick={() => setLabelModal({ product: null, quantity: 1, loading: false, template: 'standard' })} disabled={labelModal.loading} className="py-3 px-4 bg-gray-500 text-white border-none rounded-md cursor-pointer text-sm">Iptal</button>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
}

export default Products;
