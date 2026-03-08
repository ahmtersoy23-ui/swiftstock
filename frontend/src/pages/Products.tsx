import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/appStore';
import api, { apiClient, serialApi } from '../lib/api';
import type { Product } from '../types';
import { translations } from '../i18n/translations';
import * as XLSX from 'xlsx';
import './Products.css';

function Products() {
  const navigate = useNavigate();
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

  // Label print modal state
  const [labelModal, setLabelModal] = useState<{
    product: Product | null;
    quantity: number;
    loading: boolean;
  }>({ product: null, quantity: 1, loading: false });

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
    } catch {
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
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setError(errorObj.response?.data?.error || 'Failed to delete product');
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
    } catch {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      setError(errorObj.response?.data?.error || 'Failed to add product');
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
        const rows: Array<{ sku_code: string; product_name: string; category?: string }> = [];

        if (isExcel) {
          // Parse Excel file
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

          // Skip header row if present
          const startIndex = jsonData[0]?.some((cell: unknown) =>
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
          } catch (err: unknown) {
            // Check if it's a duplicate key error
            const errorObj = err as { response?: { data?: { error?: string } } };
            if (errorObj.response?.data?.error?.includes('duplicate') ||
                errorObj.response?.data?.error?.includes('already exists')) {
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
      } catch {
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

  // Opens the label quantity modal (no API call here)
  const handlePrintLabel = (product: Product) => {
    setLabelModal({ product, quantity: 1, loading: false });
  };

  // Called from modal: generates serials via main-page API, then opens print popup
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

  // Opens print popup and renders labels from pre-fetched serial data (no API call in popup)
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
