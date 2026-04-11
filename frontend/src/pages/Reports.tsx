import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores/appStore';
import { apiClient, reportApi } from '../lib/api';

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

interface CountReportDetailItem {
  sku_code: string;
  product_name?: string;
  expected_quantity: number;
  counted_quantity: number;
  variance: number;
}

interface CountReportDetailLocation {
  location_code: string;
  total_expected: number;
  total_counted: number;
  total_variance: number;
  items?: CountReportDetailItem[];
  unexpectedItems?: CountReportDetailItem[];
}

interface CountReportDetail {
  report: CountReport;
  locations?: CountReportDetailLocation[];
}

interface InventoryReportItem {
  sku_code: string;
  product_sku?: string;
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
  const [selectedReport, setSelectedReport] = useState<CountReportDetail | null>(null);

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
        setSelectedReport(response.data as CountReportDetail | null);
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
    <div className="min-h-[calc(100vh-120px)] bg-slate-100 p-4 max-sm:p-2">
      <div className="max-w-[800px] mx-auto bg-white rounded-2xl max-sm:rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 bg-gradient-to-br from-blue-500 to-blue-700 text-white">
          <button className="bg-white/20 border-none text-white w-9 h-9 rounded-lg text-[1.125rem] cursor-pointer flex items-center justify-center transition-colors duration-150 hover:bg-white/30" onClick={() => navigate('/')}>
            ←
          </button>
          <h2 className="m-0 text-xl font-bold flex-1 text-white">{language === 'tr' ? 'Raporlar' : 'Reports'}</h2>
          <button onClick={() => {
            if (reportType === 'INVENTORY' && inventoryReport?.items?.length) {
              import('../utils/exportXlsx').then(({ exportToXlsx }) => {
                exportToXlsx(
                  inventoryReport.items.map(item => ({
                    SKU: item.product_sku || item.sku_code || '',
                    Product: item.product_name || '',
                    Barcode: item.barcode || '',
                    Quantity: item.quantity || 0,
                    Locations: item.location_count || 0,
                  })),
                  `inventory-report-${currentWarehouse}-${new Date().toISOString().slice(0, 10)}`,
                  'Inventory',
                );
              });
            } else if (reportType === 'COUNT' && countReports.length) {
              import('../utils/exportXlsx').then(({ exportToXlsx }) => {
                exportToXlsx(
                  countReports.map(r => ({
                    Report: r.report_number,
                    Date: r.report_date,
                    Locations: r.total_locations,
                    Expected: r.total_expected,
                    Counted: r.total_counted,
                    Variance: r.total_variance,
                  })),
                  `count-reports-${new Date().toISOString().slice(0, 10)}`,
                  'Count Reports',
                );
              });
            }
          }} className="px-3 py-1.5 bg-white/20 text-white border-2 border-white/30 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white/30">
            ↓ XLSX
          </button>
          <div className="bg-white/20 text-white px-3 py-2 rounded-lg text-[0.8125rem] font-semibold">{currentWarehouse}</div>
        </div>

        {/* Report Type Selector */}
        <div className="grid grid-cols-2 gap-2 p-4 bg-slate-100">
          <button
            className={`px-4 py-3 border-none rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 ${reportType === 'COUNT' ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
            onClick={() => { setReportType('COUNT'); setSelectedReport(null); }}
          >
            {language === 'tr' ? 'Sayım Raporları' : 'Count Reports'}
          </button>
          <button
            className={`px-4 py-3 border-none rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 ${reportType === 'INVENTORY' ? 'bg-primary-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
            onClick={() => { setReportType('INVENTORY'); setSelectedReport(null); }}
          >
            {language === 'tr' ? 'Envanter Raporu' : 'Inventory Report'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center p-8">
            <span className="text-[2rem] animate-pulse">...</span>
          </div>
        )}

        {/* COUNT REPORTS LIST */}
        {reportType === 'COUNT' && !loading && !selectedReport && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="flex justify-between items-center px-4 py-3 bg-slate-100 text-[0.8125rem] font-semibold text-slate-600">
              <span>{language === 'tr' ? 'Sayım Raporları' : 'Count Reports'}</span>
              <span className="bg-primary-500 text-white px-2 py-1 rounded-full text-xs">{countReports.length}</span>
            </div>
            {countReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {language === 'tr' ? 'Henüz sayım raporu yok' : 'No count reports yet'}
              </div>
            ) : (
              countReports.map((report) => (
                <div
                  key={report.report_id}
                  className="flex justify-between items-center p-4 border-b border-slate-200 cursor-pointer transition-colors duration-150 hover:bg-slate-100"
                  onClick={() => loadReportDetails(report.report_id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-slate-800 text-[0.9375rem]">{report.report_number}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {report.warehouse_name || report.warehouse_code} • {new Date(report.report_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}
                    </div>
                    <div className="text-[0.6875rem] text-slate-400 mt-1">
                      {report.total_locations} {language === 'tr' ? 'lokasyon' : 'locations'} • {language === 'tr' ? 'Olusturan' : 'By'}: {report.created_by}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`block font-bold text-base ${report.total_variance === 0 ? 'text-success-500' : report.total_variance > 0 ? 'text-primary-500' : 'text-error-500'}`}>
                      {report.total_variance > 0 ? '+' : ''}{report.total_variance}
                    </span>
                    <span className="text-[0.6875rem] text-slate-400">{report.variance_percentage}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* COUNT REPORT DETAIL */}
        {reportType === 'COUNT' && selectedReport && (
          <div className="p-4">
            <button className="bg-slate-100 border-none px-4 py-3 rounded-lg text-sm text-slate-600 cursor-pointer w-full text-left mb-4 transition-colors duration-150 hover:bg-slate-200" onClick={() => setSelectedReport(null)}>
              ← {language === 'tr' ? 'Geri' : 'Back'}
            </button>

            <div className="flex justify-between items-start bg-success-50 p-4 rounded-xl mb-4 border border-success-200">
              <div>
                <h3 className="m-0 text-success-700 text-base">{selectedReport.report.report_number}</h3>
                <span className="text-[0.8125rem] text-slate-600">
                  {selectedReport.report.warehouse_name || selectedReport.report.warehouse_code}
                </span>
              </div>
              <span className="text-[0.8125rem] text-slate-600">
                {new Date(selectedReport.report.report_date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 max-sm:gap-2 mb-4">
              <div className="bg-slate-100 p-4 max-sm:p-3 rounded-lg text-center">
                <span className="block text-[1.375rem] max-sm:text-[1.125rem] font-bold text-slate-800">{selectedReport.report.total_expected}</span>
                <span className="text-[0.6875rem] text-slate-500 uppercase">{language === 'tr' ? 'Beklenen' : 'Expected'}</span>
              </div>
              <div className="bg-slate-100 p-4 max-sm:p-3 rounded-lg text-center">
                <span className="block text-[1.375rem] max-sm:text-[1.125rem] font-bold text-slate-800">{selectedReport.report.total_counted}</span>
                <span className="text-[0.6875rem] text-slate-500 uppercase">{language === 'tr' ? 'Sayilan' : 'Counted'}</span>
              </div>
              <div className={`p-4 max-sm:p-3 rounded-lg text-center ${selectedReport.report.total_variance === 0 ? 'bg-success-50 border border-success-200' : selectedReport.report.total_variance > 0 ? 'bg-primary-50 border border-primary-200' : 'bg-error-50 border border-error-200'}`}>
                <span className={`block text-[1.375rem] max-sm:text-[1.125rem] font-bold ${selectedReport.report.total_variance === 0 ? 'text-success-600' : selectedReport.report.total_variance > 0 ? 'text-primary-600' : 'text-error-600'}`}>
                  {selectedReport.report.total_variance > 0 ? '+' : ''}{selectedReport.report.total_variance}
                </span>
                <span className="text-[0.6875rem] text-slate-500 uppercase">{language === 'tr' ? 'Fark' : 'Variance'}</span>
              </div>
            </div>

            {/* Locations */}
            <div className="bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
              <div className="flex justify-between items-center px-4 py-3 bg-slate-200 text-[0.8125rem] font-semibold text-slate-600">
                <span>{language === 'tr' ? 'Lokasyonlar' : 'Locations'}</span>
                <span className="bg-primary-500 text-white px-2 py-1 rounded-full text-xs">{selectedReport.locations?.length || 0}</span>
              </div>
              {selectedReport.locations?.map((loc, locIdx) => (
                <div key={locIdx} className="border-b border-slate-300 pb-2 last:border-b-0">
                  <div className="flex justify-between items-center px-4 py-3 bg-white">
                    <span className="font-mono font-semibold text-slate-800">{loc.location_code}</span>
                    <span className="text-xs text-slate-500">
                      {loc.total_expected} → {loc.total_counted}
                      <span className={`ml-2 font-semibold ${loc.total_variance === 0 ? 'text-success-500' : loc.total_variance > 0 ? 'text-primary-500' : 'text-error-500'}`}>
                        ({loc.total_variance > 0 ? '+' : ''}{loc.total_variance})
                      </span>
                    </span>
                  </div>
                  {/* Items in location */}
                  {loc.items?.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex justify-between items-center py-2 px-4 pl-6 text-[0.8125rem]">
                      <div className="flex-1 min-w-0">
                        <span className="block text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">{item.product_name || item.sku_code}</span>
                        <span className="block text-[0.6875rem] text-slate-400">{item.sku_code}</span>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <span>{item.expected_quantity} → {item.counted_quantity}</span>
                        {item.variance !== 0 && (
                          <span className={`ml-1 ${item.variance > 0 ? 'text-primary-500' : 'text-error-500'}`}>
                            ({item.variance > 0 ? '+' : ''}{item.variance})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Unexpected items */}
                  {(loc.unexpectedItems?.length ?? 0) > 0 && (
                    <>
                      <div className="py-2 px-4 pl-6 text-[0.6875rem] text-warning-600 font-semibold">
                        {language === 'tr' ? 'Beklenmeyen Urunler' : 'Unexpected Items'}
                      </div>
                      {loc.unexpectedItems!.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex justify-between items-center py-2 px-4 pl-6 text-[0.8125rem] bg-warning-50">
                          <div className="flex-1 min-w-0">
                            <span className="block text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">{item.product_name || item.sku_code}</span>
                            <span className="block text-[0.6875rem] text-slate-400">{item.sku_code}</span>
                          </div>
                          <span className="text-warning-600 font-semibold">+{item.counted_quantity}</span>
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
          <div className="p-4">
            {inventoryReport ? (
              <>
                <div className="flex justify-between items-start bg-info-50 p-4 rounded-xl mb-4 border border-info-200">
                  <div>
                    <h3 className="m-0 text-info-700 text-base">{language === 'tr' ? 'Envanter Raporu' : 'Inventory Report'}</h3>
                    <span className="text-[0.8125rem] text-info-600">
                      {inventoryReport.warehouse.name} ({inventoryReport.warehouse.code})
                    </span>
                  </div>
                  <span className="text-[0.8125rem] text-info-600">{inventoryReport.report_date}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-info-50 p-4 rounded-lg text-center border border-info-200">
                    <span className="block text-[1.375rem] font-bold text-info-700">{inventoryReport.summary.total_products}</span>
                    <span className="text-[0.6875rem] text-info-600 uppercase">{language === 'tr' ? 'Urun' : 'Products'}</span>
                  </div>
                  <div className="bg-info-50 p-4 rounded-lg text-center border border-info-200">
                    <span className="block text-[1.375rem] font-bold text-info-700">{inventoryReport.summary.total_quantity}</span>
                    <span className="text-[0.6875rem] text-info-600 uppercase">{language === 'tr' ? 'Toplam Adet' : 'Total Qty'}</span>
                  </div>
                </div>

                <div className="bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  <div className="flex justify-between items-center px-4 py-3 bg-slate-100 text-[0.8125rem] font-semibold text-slate-600">
                    <span>{language === 'tr' ? 'Urunler' : 'Products'}</span>
                    <span className="bg-primary-500 text-white px-2 py-1 rounded-full text-xs">{inventoryReport.items.length}</span>
                  </div>
                  {inventoryReport.items.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      {language === 'tr' ? 'Bu depoda stok yok' : 'No stock in this warehouse'}
                    </div>
                  ) : (
                    inventoryReport.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center px-4 py-3 border-b border-slate-200 bg-white last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <span className="block text-slate-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{item.product_name}</span>
                          <span className="block text-xs text-slate-500">{item.sku_code}</span>
                          {item.location_count && (
                            <span className="block text-[0.6875rem] text-slate-400">
                              {item.location_count} {language === 'tr' ? 'lokasyonda' : 'locations'}
                            </span>
                          )}
                        </div>
                        <span className="text-base font-bold text-info-600">{item.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <span className="text-[2.5rem] mb-4">...</span>
                <h3 className="m-0 mb-2 text-slate-600 text-base">{language === 'tr' ? 'Envanter Raporu' : 'Inventory Report'}</h3>
                <p className="m-0 mb-6 text-slate-500 text-sm">{language === 'tr' ? 'Secili depodaki tum stok bilgisini goruntuleyin' : 'View all stock in the selected warehouse'}</p>
                <button className="bg-primary-500 text-white border-none px-6 py-3 rounded-lg text-[0.9375rem] font-medium cursor-pointer transition-colors duration-150 hover:bg-primary-600" onClick={loadInventoryReport}>
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
