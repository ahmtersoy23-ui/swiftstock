import { useEffect, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import api, { apiClient } from '../lib/api';
import type { Product } from '../types';
import { translations } from '../i18n/translations';
import * as XLSX from 'xlsx';
import './Products.css';

function Products() {
  const { language, currentWarehouse } = useStore();
  const t = translations[language];
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [pageSize] = useState(100);
  const [searchDebounce, setSearchDebounce] = useState('');

  // Selection state for bulk delete
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [allCategories, setAllCategories] = useState<string[]>([]);

  // Toggle individual product selection
  const toggleSelectProduct = (skuCode: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(skuCode)) {
        newSet.delete(skuCode);
      } else {
        newSet.add(skuCode);
      }
      return newSet;
    });
  };

  // Toggle select all products on current page
  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      // Deselect all
      setSelectedProducts(new Set());
    } else {
      // Select all on current page
      setSelectedProducts(new Set(products.map((p) => p.sku_code)));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedProducts.size} product${selectedProducts.size > 1 ? 's' : ''}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setError(null);
    setSuccess(null);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const skuCode of Array.from(selectedProducts)) {
        try {
          await apiClient.deleteProduct(skuCode);
          successCount++;
        } catch {
          errorCount++;
        }
      }

      setSuccess(`Deleted ${successCount} product${successCount > 1 ? 's' : ''}${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
      setSelectedProducts(new Set());
      loadProducts();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Failed to delete products');
    }
  };

  // Handle single product delete
  const handleDeleteProduct = async (product: Product) => {
    const confirmed = window.confirm(
      `Delete product "${product.product_name}"?\n\nIWASKU: ${product.sku_code}\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setError(null);
    setSuccess(null);

    try {
      await apiClient.deleteProduct(product.sku_code);
      setSuccess(`Product deleted: ${product.sku_code}`);
      setSelectedProducts(new Set());
      loadProducts();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete product');
    }
  };

  // Handle delete all products
  const handleDeleteAll = async () => {
    const confirmed = window.confirm(
      `⚠️ WARNING: DELETE ALL PRODUCTS\n\nThis will permanently delete ALL ${totalProducts.toLocaleString()} products from the database.\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" in the next prompt to confirm.`
    );

    if (!confirmed) return;

    const confirmText = window.prompt(
      `To confirm deletion of ALL products, type: DELETE ALL`
    );

    if (confirmText !== 'DELETE ALL') {
      setError('Delete all cancelled - confirmation text did not match');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      // Fetch all products in batches and delete them
      let currentPageNum = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `/api/products?page=${currentPageNum}&limit=100`
        );
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
          for (const product of data.data) {
            try {
              await apiClient.deleteProduct(product.sku_code);
              successCount++;

              // Update progress every 50 deletions
              if (successCount % 50 === 0) {
                setSuccess(`Deleting... ${successCount} deleted so far`);
              }
            } catch {
              errorCount++;
            }
          }

          hasMore = currentPageNum < data.pagination.totalPages;
          currentPageNum++;
        } else {
          hasMore = false;
        }
      }

      setSuccess(`Delete all completed: ${successCount} deleted${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
      setSelectedProducts(new Set());
      loadProducts();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError('Failed to delete all products');
    } finally {
      setLoading(false);
    }
  };

  // Form state for single product
  const [newProduct, setNewProduct] = useState({
    sku_code: '',
    product_name: '',
    category: '',
    description: '',
    base_unit: 'EACH' as 'EACH' | 'BOX' | 'PALLET',
    units_per_box: 1,
    boxes_per_pallet: 1,
    weight_kg: '',
    dimensions_cm: '',
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(search);
      setCurrentPage(1); // Reset to first page on search
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
      // Build query with category filter for server-side filtering
      let url = `/products?page=${currentPage}&limit=${pageSize}&search=${searchDebounce}`;
      if (categoryFilter) {
        url += `&category=${encodeURIComponent(categoryFilter)}`;
      }

      const response = await api.get(url);
      const data = response.data;

      if (data.success && data.data) {
        // Extract unique categories from all products for the dropdown (only once)
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
    } catch (err: any) {
      console.error('Failed to load products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const productData = {
        ...newProduct,
        weight_kg: newProduct.weight_kg ? parseFloat(newProduct.weight_kg) : undefined,
        dimensions_cm: newProduct.dimensions_cm || undefined,
        description: newProduct.description || undefined,
        category: newProduct.category || undefined,
      };

      await apiClient.createProduct(productData);
      setSuccess('Product added successfully!');
      setShowAddForm(false);
      setNewProduct({
        sku_code: '',
        product_name: '',
        category: '',
        description: '',
        base_unit: 'EACH',
        units_per_box: 1,
        boxes_per_pallet: 1,
        weight_kg: '',
        dimensions_cm: '',
      });
      loadProducts();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add product');
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isExcel = fileExtension === 'xlsx' || fileExtension === 'xls';

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let rows: Array<{ sku_code: string; product_name: string; category?: string }> = [];

        if (isExcel) {
          // Parse Excel file
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          // Skip header row if present
          const startIndex = jsonData[0]?.some((cell: any) =>
            String(cell).toLowerCase().includes('iwasku') ||
            String(cell).toLowerCase().includes('sku')
          ) ? 1 : 0;

          // Process Excel rows
          for (let i = startIndex; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            const sku_code = String(row[0] || '').trim();
            const product_name = String(row[1] || '').trim();
            const category = row[2] ? String(row[2]).trim() : undefined;

            if (sku_code && product_name) {
              rows.push({ sku_code, product_name, category });
            }
          }
        } else {
          // Parse CSV file
          const text = event.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());

          // Skip header if present
          const startIndex = lines[0].toLowerCase().includes('iwasku') || lines[0].toLowerCase().includes('sku') ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // CSV format: iwasku,product_name,category
            const [sku_code, product_name, category] = line.split(',').map(field => field.trim());

            if (sku_code && product_name) {
              rows.push({ sku_code, product_name, category });
            }
          }
        }

        if (rows.length === 0) {
          setError('No valid products found in file');
          setLoading(false);
          return;
        }

        setSuccess(`Processing ${rows.length} products...`);

        // Import all rows
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];

          try {
            await apiClient.createProduct({
              sku_code: row.sku_code,
              product_name: row.product_name,
              category: row.category || undefined,
              base_unit: 'EACH',
              units_per_box: 1,
              boxes_per_pallet: 1,
            });
            successCount++;

            // Update progress every 100 products
            if ((i + 1) % 100 === 0) {
              setSuccess(`Processing... ${i + 1}/${rows.length} (${successCount} added, ${skipCount} skipped)`);
            }
          } catch (err: any) {
            // Check if it's a duplicate key error
            if (err.response?.data?.error?.includes('duplicate') ||
                err.response?.data?.error?.includes('already exists')) {
              skipCount++;
            } else {
              errorCount++;
            }
          }
        }

        setSuccess(`Import completed: ${successCount} added, ${skipCount} skipped (duplicates)${errorCount > 0 ? `, ${errorCount} errors` : ''}`);
        setShowBulkImport(false);
        loadProducts();

        setTimeout(() => setSuccess(null), 5000);
      } catch (err) {
        setError(`Failed to parse ${isExcel ? 'Excel' : 'CSV'} file`);
      } finally {
        setLoading(false);
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePrintLabel = async (product: Product) => {
    // Open preview window with serial number support
    const printWindow = window.open('', '_blank', 'width=700,height=900');
    if (!printWindow) return;

    // API base URL for serial generation
    const apiBaseUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3001/api'
      : `http://${window.location.hostname}:3001/api`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Serial Label - ${product.sku_code}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .section h2 { margin-bottom: 15px; color: #2563eb; text-align: center; }
            .preview-label {
              width: 100mm; height: 30mm; border: 2px solid #2563eb; padding: 2mm;
              background: white; display: inline-flex; flex-direction: row;
              align-items: center; gap: 3mm; margin: 15px auto;
            }
            .label-left { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-right: 2mm; }
            .product-name { font-size: 9pt; font-weight: bold; line-height: 1.2; overflow: hidden;
              display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
            .label-right { display: flex; flex-direction: column; align-items: center; gap: 1mm; flex-shrink: 0; }
            .barcode-container { width: 48mm; height: 18mm; display: flex; align-items: center; justify-content: center; }
            .barcode-container svg { max-width: 100%; max-height: 100%; }
            .serial-code { font-size: 7pt; font-family: 'Courier New', monospace; color: #333; text-align: center; font-weight: bold; }
            .input-section { text-align: center; }
            .input-section label { display: block; margin-bottom: 10px; font-weight: bold; font-size: 16px; }
            .input-section input { padding: 12px; font-size: 20px; width: 180px; text-align: center;
              border: 2px solid #e5e7eb; border-radius: 6px; margin-bottom: 15px; }
            .input-section input:focus { outline: none; border-color: #2563eb; }
            .btn { padding: 14px 28px; margin: 5px; cursor: pointer; font-size: 16px; border: none; border-radius: 6px; font-weight: 600; }
            .btn-generate { background: #10b981; color: white; }
            .btn-generate:hover { background: #059669; }
            .btn-generate:disabled { background: #9ca3af; cursor: not-allowed; }
            .btn-print { background: #2563eb; color: white; }
            .btn-print:hover { background: #1d4ed8; }
            .btn-close { background: #6b7280; color: white; }
            .btn-close:hover { background: #4b5563; }
            .labels-container { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-start; padding: 20px; background: white; border-radius: 8px; }
            .label { width: 100mm; height: 30mm; border: 1px dashed #999; padding: 2mm; background: white;
              display: flex; flex-direction: row; align-items: center; gap: 3mm; page-break-inside: avoid; }
            .hidden { display: none; }
            .loading { text-align: center; padding: 20px; color: #6b7280; }
            .info-box { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 6px; padding: 12px; margin: 15px 0; text-align: center; }
            .info-box strong { color: #1d4ed8; }
            @media print {
              body { padding: 0; background: white; }
              .section, .controls { display: none !important; }
              .labels-container { padding: 0; background: transparent; }
              .label { border: none; }
              @page { size: auto; margin: 5mm; }
            }
          </style>
        </head>
        <body>
          <div class="section" id="preview-section">
            <h2>🏷️ Seri Numaralı Etiket</h2>
            <p style="text-align: center; color: #6b7280; margin-bottom: 10px;">Her etiket benzersiz seri numarası içerecek</p>
            <div style="text-align: center;">
              <div class="preview-label">
                <div class="label-left">
                  <div class="product-name">${product.product_name}</div>
                </div>
                <div class="label-right">
                  <div class="barcode-container">
                    <svg id="preview-barcode"></svg>
                  </div>
                  <div class="serial-code">${product.sku_code}-XXXXXX</div>
                </div>
              </div>
            </div>
            <div class="info-box">
              <strong>Ürün:</strong> ${product.sku_code}<br>
              <small>Her etiket: <code>${product.sku_code}-000001</code>, <code>${product.sku_code}-000002</code>... formatında</small>
            </div>
          </div>

          <div class="section input-section" id="input-section">
            <label>Kaç adet etiket basılacak?</label>
            <input type="number" id="quantity-input" min="1" max="500" value="1" autofocus />
            <br>
            <button class="btn btn-generate" id="generate-btn" onclick="generateSerialLabels()">
              ✅ Seri No Oluştur ve Hazırla
            </button>
          </div>

          <div class="section controls hidden" id="print-controls">
            <div style="text-align: center;">
              <button class="btn btn-print" onclick="window.print()">🖨️ Yazdır</button>
              <button class="btn btn-close" onclick="window.close()">✕ Kapat</button>
            </div>
          </div>

          <div class="labels-container hidden" id="labels-container"></div>

          <script>
            const SKU_CODE = "${product.sku_code}";
            const PRODUCT_NAME = "${product.product_name.replace(/"/g, '\\"')}";
            const API_URL = "${apiBaseUrl}";

            // Preview barcode
            JsBarcode("#preview-barcode", SKU_CODE + "-000001", {
              format: "CODE128", width: 1.8, height: 55, displayValue: false, margin: 0
            });

            document.getElementById('quantity-input').addEventListener('keypress', function(e) {
              if (e.key === 'Enter') generateSerialLabels();
            });

            async function generateSerialLabels() {
              const quantity = parseInt(document.getElementById('quantity-input').value);
              if (!quantity || quantity < 1) { alert('En az 1 adet giriniz'); return; }
              if (quantity > 500) { alert('Maksimum 500 etiket'); return; }

              const btn = document.getElementById('generate-btn');
              btn.disabled = true;
              btn.textContent = '⏳ Seri numaraları oluşturuluyor...';

              try {
                const response = await fetch(API_URL + '/serials/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sku_code: SKU_CODE, quantity: quantity })
                });

                const result = await response.json();

                if (!result.success) {
                  throw new Error(result.error || 'Seri numarası oluşturulamadı');
                }

                const serials = result.data.serials;

                // Hide input sections
                document.getElementById('preview-section').classList.add('hidden');
                document.getElementById('input-section').classList.add('hidden');

                // Show print controls
                document.getElementById('print-controls').classList.remove('hidden');
                const container = document.getElementById('labels-container');
                container.classList.remove('hidden');

                // Generate label HTML for each serial
                let labelsHTML = '';
                serials.forEach((s, i) => {
                  labelsHTML += \`
                    <div class="label">
                      <div class="label-left">
                        <div class="product-name">\${PRODUCT_NAME}</div>
                      </div>
                      <div class="label-right">
                        <div class="barcode-container">
                          <svg id="barcode-\${i}"></svg>
                        </div>
                        <div class="serial-code">\${s.full_barcode}</div>
                      </div>
                    </div>
                  \`;
                });
                container.innerHTML = labelsHTML;

                // Generate barcodes
                serials.forEach((s, i) => {
                  JsBarcode("#barcode-" + i, s.full_barcode, {
                    format: "CODE128", width: 1.8, height: 55, displayValue: false, margin: 0
                  });
                });

                // Update print button
                document.querySelector('.btn-print').textContent = \`🖨️ \${quantity} Etiket Yazdır\`;

              } catch (error) {
                alert('Hata: ' + error.message);
                btn.disabled = false;
                btn.textContent = '✅ Seri No Oluştur ve Hazırla';
              }
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="products-page">
      <div className="products-card">
        {/* Header */}
        <div className="products-header">
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
            {selectedProducts.size > 0 && (
              <button onClick={handleBulkDelete} className="btn-delete">
                {t.deleteSelected} ({selectedProducts.size})
              </button>
            )}
          </div>
          <div className="header-actions">
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
              {t.addProduct}
            </button>
            <button onClick={() => setShowBulkImport(!showBulkImport)} className="btn-secondary">
              {t.bulkImport}
            </button>
            {totalProducts > 0 && (
              <button onClick={handleDeleteAll} className="btn-delete-all">
                {t.deleteAll}
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="products-stats">
            <span>{totalProducts.toLocaleString()} {t.total}</span>
          </div>

      {success && <div className="success">✅ {success}</div>}
      {error && <div className="error">❌ {error}</div>}

      {/* Add Single Product Form */}
      {showAddForm && (
        <div className="add-form-container">
          <form onSubmit={handleAddProduct} className="add-form">
            <h3>Add New Product</h3>
            <div className="form-row">
              <div className="form-group">
                <label>IWASKU *</label>
                <input
                  type="text"
                  value={newProduct.sku_code}
                  onChange={(e) => setNewProduct({ ...newProduct, sku_code: e.target.value })}
                  placeholder="e.g., CA041C0A8DWG"
                  required
                />
              </div>
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  value={newProduct.product_name}
                  onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Base Unit</label>
                <select
                  value={newProduct.base_unit}
                  onChange={(e) => setNewProduct({ ...newProduct, base_unit: e.target.value as 'EACH' | 'BOX' | 'PALLET' })}
                >
                  <option value="EACH">EACH</option>
                  <option value="BOX">BOX</option>
                  <option value="PALLET">PALLET</option>
                </select>
              </div>
              <div className="form-group">
                <label>Units per Box</label>
                <input
                  type="number"
                  value={newProduct.units_per_box}
                  onChange={(e) => setNewProduct({ ...newProduct, units_per_box: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Boxes per Pallet</label>
                <input
                  type="number"
                  value={newProduct.boxes_per_pallet}
                  onChange={(e) => setNewProduct({ ...newProduct, boxes_per_pallet: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.weight_kg}
                  onChange={(e) => setNewProduct({ ...newProduct, weight_kg: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dimensions (cm)</label>
                <input
                  type="text"
                  placeholder="e.g., 10x20x30"
                  value={newProduct.dimensions_cm}
                  onChange={(e) => setNewProduct({ ...newProduct, dimensions_cm: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group full-width">
              <label>Description</label>
              <textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">Save Product</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-cancel">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Import Section */}
      {showBulkImport && (
        <div className="bulk-import-container">
          <h3>📤 Bulk Import Products</h3>
          <p className="import-instructions">
            Upload a CSV or Excel file with the following columns:<br />
            <code>iwasku,product_name,category</code><br />
            <small style={{ display: 'block', marginTop: '8px' }}>
              Example: CA041C0A8DWG,Product Name,Category Name<br />
              (Header row is optional)
            </small>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleBulkImport}
            className="file-input"
          />
          <button onClick={() => setShowBulkImport(false)} className="btn-cancel">Cancel</button>
        </div>
      )}

      {loading && <div className="loading">{t.loadingProducts}</div>}

      {!loading && !error && products.length > 0 && (
        <>
          {/* Card View */}
          <div className="products-cards">
            <div className="cards-select-all">
              <label>
                <input
                  type="checkbox"
                  checked={selectedProducts.size === products.length && products.length > 0}
                  onChange={toggleSelectAll}
                />
                <span>{t.selectAll || 'Tümünü Seç'}</span>
              </label>
            </div>
            {products.map((product) => (
              <div
                key={product.sku_code}
                className={`product-card ${selectedProducts.has(product.sku_code) ? 'selected' : ''}`}
              >
                <div className="card-header">
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.sku_code)}
                    onChange={() => toggleSelectProduct(product.sku_code)}
                  />
                  <span className="card-sku">{product.sku_code}</span>
                  {product.category && <span className="card-category">{product.category}</span>}
                </div>
                <div className="card-body">
                  <div className="card-name">{product.product_name}</div>
                  <div className="card-details">
                    <span>{product.base_unit}</span>
                    <span>{product.units_per_box} {t.unitsPerBox}</span>
                    {product.weight_kg && <span>{product.weight_kg} kg</span>}
                  </div>
                </div>
                <div className="card-actions">
                  <button onClick={() => handlePrintLabel(product)} className="card-btn print">
                    🖨️ {t.printLabel}
                  </button>
                  <button onClick={() => handleDeleteProduct(product)} className="card-btn delete">
                    🗑️ {t.delete || 'Sil'}
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
    </div>
  );
}

export default Products;
