import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/appStore';
import { apiClient, reportApi } from '../lib/api';
import './Reports.css';

type ReportType = 'COUNT' | 'INVENTORY';

interface CountReport {
  report_id: number;
  report_number: string;
  warehouse_code: string;
  warehouse_name: string;
  report_date: string;
  total_locations: number;
  total_expected: number;
  total_counted: number;
  total_variance: number;
  variance_percentage: string;
  created_by: string;
  created_at: string;
}

interface InventoryReportItem {
  sku_code: string;
  product_name: string;
  barcode: string;
  quantity: number;
  units_per_box: number;
  boxes_per_pallet: number;
  location_count?: number;
  location_code?: string;
}

function Reports() {
  const navigate = useNavigate();
  const { currentWarehouse, language } = useStore();

  const [reportType, setReportType] = useState<ReportType>('COUNT');
  const [countReports, setCountReports] = useState<CountReport[]>([]);
  const [inventoryReport, setInventoryReport] = useState<{
    warehouse: { warehouse_id: number; code: string; name: string };
    report_date: string;
    summary: { total_products: number; total_quantity: number; total_items: number };
    items: InventoryReportItem[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  // Load count reports
  const loadCountReports = async () => {
    setLoading(true);
    try {
      const response = await reportApi.getCountReports({ limit: 50 });
      if (response.success) {
        setCountReports(response.data || []);
      }
    } catch (err) {
      console.error('Failed to load count reports:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load inventory report for current warehouse
  const loadInventoryReport = async () => {
    setLoading(true);
    setInventoryReport(null);
    try {
      const warehouseResponse = await apiClient.getWarehouseByCode(currentWarehouse);
      const warehouseId = warehouseResponse?.data?.warehouse_id;
      if (!warehouseId) {
        return;
      }

      const response = await reportApi.getInventoryReport(warehouseId);
      if (response.success) {
        setInventoryReport(response.data);
      }
    } catch (err) {
      console.error('Failed to load inventory report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load report details
  const loadReportDetails = async (reportId: number) => {
    setLoading(true);
    try {
      const response = await reportApi.getCountReportById(reportId);
      if (response.success) {
        setSelectedReport(response.data);
      }
    } catch (err) {
      console.error('Failed to load report details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load reports when type changes
  useEffect(() => {
    if (reportType === 'COUNT') {
      loadCountReports();
    } else {
      loadInventoryReport();
    }
  }, [reportType, currentWarehouse]);

  return (
    <div className="reports-page">
      <div className="reports-card">
        {/* Header */}
        <div className="reports-header">
          <button className="back-btn" onClick={() => navigate('/')}>
            ←
          </button>
          <h2>{language === 'tr' ? 'Raporlar' : 'Reports'}</h2>
          <div className="warehouse-badge">{currentWarehouse}</div>
        </div>

        {/* Report Type Selector */}
        <div className="report-type-buttons">
          <button
            className={`type-btn ${reportType === 'COUNT' ? 'active' : ''}`}
            onClick={() => { setReportType('COUNT'); setSelectedReport(null); }}
          >
            {language === 'tr' ? 'Sayım Raporları' : 'Count Reports'}
          </button>
          <button
            className={`type-btn ${reportType === 'INVENTORY' ? 'active' : ''}`}
            onClick={() => { setReportType('INVENTORY'); setSelectedReport(null); }}
          >
            {language === 'tr' ? 'Envanter Raporu' : 'Inventory Report'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="reports-loading">
            <span className="loading-icon">...</span>
          </div>
        )}

        {/* COUNT REPORTS LIST */}
        {reportType === 'COUNT' && !loading && !selectedReport && (
          <div className="reports-list">
            <div className="list-header">
              <span>{language === 'tr' ? 'Sayım Raporları' : 'Count Reports'}</span>
              <span className="list-count">{countReports.length}</span>
            </div>
            {countReports.length === 0 ? (
              <div className="empty-state">
                {language === 'tr' ? 'Henüz sayım raporu yok' : 'No count reports yet'}
              </div>
            ) : (
              countReports.map((report) => (
                <div
                  key={report.report_id}
                  className="report-item"
                  onClick={() => loadReportDetails(report.report_id)}
                >
                  <div className="report-item-info">
                    <div className="report-number">{report.report_number}</div>
                    <div className="report-meta">
                      {report.warehouse_name || report.warehouse_code} • {new Date(report.report_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}
                    </div>
                    <div className="report-extra">
                      {report.total_locations} {language === 'tr' ? 'lokasyon' : 'locations'} • {language === 'tr' ? 'Olusturan' : 'By'}: {report.created_by}
                    </div>
                  </div>
                  <div className="report-variance">
                    <span className={`variance-value ${report.total_variance === 0 ? 'zero' : report.total_variance > 0 ? 'positive' : 'negative'}`}>
                      {report.total_variance > 0 ? '+' : ''}{report.total_variance}
                    </span>
                    <span className="variance-percent">{report.variance_percentage}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* COUNT REPORT DETAIL */}
        {reportType === 'COUNT' && selectedReport && (
          <div className="report-detail">
            <button className="back-btn-inline" onClick={() => setSelectedReport(null)}>
              ← {language === 'tr' ? 'Geri' : 'Back'}
            </button>

            <div className="detail-header">
              <div className="detail-title">
                <h3>{selectedReport.report.report_number}</h3>
                <span className="detail-warehouse">
                  {selectedReport.report.warehouse_name || selectedReport.report.warehouse_code}
                </span>
              </div>
              <span className="detail-date">
                {new Date(selectedReport.report.report_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}
              </span>
            </div>

            <div className="detail-summary">
              <div className="summary-item">
                <span className="summary-value">{selectedReport.report.total_expected}</span>
                <span className="summary-label">{language === 'tr' ? 'Beklenen' : 'Expected'}</span>
              </div>
              <div className="summary-item">
                <span className="summary-value">{selectedReport.report.total_counted}</span>
                <span className="summary-label">{language === 'tr' ? 'Sayilan' : 'Counted'}</span>
              </div>
              <div className={`summary-item ${selectedReport.report.total_variance === 0 ? 'zero' : selectedReport.report.total_variance > 0 ? 'positive' : 'negative'}`}>
                <span className="summary-value">
                  {selectedReport.report.total_variance > 0 ? '+' : ''}{selectedReport.report.total_variance}
                </span>
                <span className="summary-label">{language === 'tr' ? 'Fark' : 'Variance'}</span>
              </div>
            </div>

            {/* Locations */}
            <div className="detail-locations">
              <div className="locations-header">
                <span>{language === 'tr' ? 'Lokasyonlar' : 'Locations'}</span>
                <span className="locations-count">{selectedReport.locations?.length || 0}</span>
              </div>
              {selectedReport.locations?.map((loc: any, locIdx: number) => (
                <div key={locIdx} className="location-block">
                  <div className="location-row">
                    <span className="location-code">{loc.location_code}</span>
                    <span className="location-stats">
                      {loc.total_expected} → {loc.total_counted}
                      <span className={`loc-variance ${loc.total_variance === 0 ? 'zero' : loc.total_variance > 0 ? 'positive' : 'negative'}`}>
                        ({loc.total_variance > 0 ? '+' : ''}{loc.total_variance})
                      </span>
                    </span>
                  </div>
                  {/* Items in location */}
                  {loc.items?.map((item: any, itemIdx: number) => (
                    <div key={itemIdx} className="item-row">
                      <div className="item-info">
                        <span className="item-name">{item.product_name || item.sku_code}</span>
                        <span className="item-sku">{item.sku_code}</span>
                      </div>
                      <div className="item-stats">
                        <span>{item.expected_quantity} → {item.counted_quantity}</span>
                        {item.variance !== 0 && (
                          <span className={`item-variance ${item.variance > 0 ? 'positive' : 'negative'}`}>
                            ({item.variance > 0 ? '+' : ''}{item.variance})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Unexpected items */}
                  {loc.unexpectedItems?.length > 0 && (
                    <>
                      <div className="unexpected-header">
                        {language === 'tr' ? 'Beklenmeyen Urunler' : 'Unexpected Items'}
                      </div>
                      {loc.unexpectedItems.map((item: any, itemIdx: number) => (
                        <div key={itemIdx} className="item-row unexpected">
                          <div className="item-info">
                            <span className="item-name">{item.product_name || item.sku_code}</span>
                            <span className="item-sku">{item.sku_code}</span>
                          </div>
                          <span className="item-unexpected-qty">+{item.counted_quantity}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INVENTORY REPORT */}
        {reportType === 'INVENTORY' && !loading && (
          <div className="inventory-report">
            {inventoryReport ? (
              <>
                <div className="inventory-header">
                  <div className="inv-title">
                    <h3>{language === 'tr' ? 'Envanter Raporu' : 'Inventory Report'}</h3>
                    <span className="inv-warehouse">
                      {inventoryReport.warehouse.name} ({inventoryReport.warehouse.code})
                    </span>
                  </div>
                  <span className="inv-date">{inventoryReport.report_date}</span>
                </div>

                <div className="inventory-summary">
                  <div className="inv-stat">
                    <span className="inv-stat-value">{inventoryReport.summary.total_products}</span>
                    <span className="inv-stat-label">{language === 'tr' ? 'Urun' : 'Products'}</span>
                  </div>
                  <div className="inv-stat">
                    <span className="inv-stat-value">{inventoryReport.summary.total_quantity}</span>
                    <span className="inv-stat-label">{language === 'tr' ? 'Toplam Adet' : 'Total Qty'}</span>
                  </div>
                </div>

                <div className="inventory-list">
                  <div className="list-header">
                    <span>{language === 'tr' ? 'Urunler' : 'Products'}</span>
                    <span className="list-count">{inventoryReport.items.length}</span>
                  </div>
                  {inventoryReport.items.length === 0 ? (
                    <div className="empty-state">
                      {language === 'tr' ? 'Bu depoda stok yok' : 'No stock in this warehouse'}
                    </div>
                  ) : (
                    inventoryReport.items.map((item, idx) => (
                      <div key={idx} className="inventory-item">
                        <div className="inv-item-info">
                          <span className="inv-item-name">{item.product_name}</span>
                          <span className="inv-item-sku">{item.sku_code}</span>
                          {item.location_count && (
                            <span className="inv-item-locs">
                              {item.location_count} {language === 'tr' ? 'lokasyonda' : 'locations'}
                            </span>
                          )}
                        </div>
                        <span className="inv-item-qty">{item.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state-large">
                <span className="empty-icon">...</span>
                <h3>{language === 'tr' ? 'Envanter Raporu' : 'Inventory Report'}</h3>
                <p>{language === 'tr' ? 'Secili depodaki tum stok bilgisini goruntuleyin' : 'View all stock in the selected warehouse'}</p>
                <button className="load-btn" onClick={loadInventoryReport}>
                  {language === 'tr' ? 'Raporu Yukle' : 'Load Report'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;
