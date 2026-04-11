// Count mode inventory list and summary components
import type { CountState } from '../types';
import type { Location } from '../../../types';

interface CountModeViewProps {
  countState: CountState;
  location: Location | null;
  language: 'tr' | 'en';
  loading: boolean;
  onSaveLocation: () => void;
  onShowSummary: () => void;
  onCancel: () => void;
  translations: {
    countSaveLocation: string;
    cancel: string;
    countTotalLocations: string;
    countSummary: string;
  };
}

export function CountModeView({
  countState,
  location,
  language,
  loading,
  onSaveLocation,
  onShowSummary,
  onCancel,
  translations,
}: CountModeViewProps) {
  if (!countState.isActive || !location || countState.showSummary) {
    return null;
  }

  const { currentLocationItems, unexpectedItems } = countState;

  return (
    <>
      <div className="p-4 bg-warning-50 rounded-xl mx-4 mb-4">
        <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-warning-200">
          <span className="font-bold text-warning-700 text-base">📋 {location.location_code}</span>
          <span className="text-sm text-warning-700 bg-warning-200 px-3 py-1 rounded-full">
            {language === 'tr'
              ? '📦 Ürün tarayın (1 barkod = 1 adet)'
              : '📦 Scan products (1 barcode = 1 item)'}
          </span>
        </div>

        {/* Expected Items with Progress */}
        {currentLocationItems.length > 0 && (
          <div className="mb-4">
            <div className="text-[0.8125rem] font-bold text-slate-500 uppercase tracking-wide mb-2 pl-1">
              {language === 'tr' ? 'Beklenen Ürünler' : 'Expected Products'}
            </div>
            <div className="flex flex-col gap-3">
              {currentLocationItems.map((item, index) => {
                const isComplete = item.counted_quantity >= item.expected_quantity;
                const isOverCount = item.counted_quantity > item.expected_quantity;
                return (
                  <div
                    key={index}
                    className={`bg-white rounded-lg p-3 shadow-xs ${isComplete ? 'bg-success-50 border-l-[3px] border-l-success-500' : ''} ${
                      isOverCount ? 'bg-warning-100 border-l-[3px] border-l-warning-500' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-1 mb-3">
                      <span className="font-semibold text-slate-800 text-[0.9375rem]">{item.product_name}</span>
                      <span className="text-xs text-slate-500">{item.sku_code}</span>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span
                        className={`text-lg font-bold font-mono ${isComplete ? 'text-success-600' : ''} ${
                          isOverCount ? 'text-warning-600' : ''
                        } ${!isComplete && !isOverCount ? 'text-slate-500' : ''}`}
                      >
                        {item.counted_quantity} / {item.expected_quantity}
                      </span>
                      {item.variance !== 0 && (
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded-lg ${
                            item.variance > 0 ? 'bg-success-100 text-success-600' : 'bg-error-100 text-error-600'
                          }`}
                        >
                          {item.variance > 0 ? '+' : ''}
                          {item.variance}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unexpected Items */}
        {unexpectedItems.length > 0 && (
          <div className="mb-4 bg-warning-100 p-3 rounded-lg border-2 border-dashed border-warning-500">
            <div className="text-[0.8125rem] font-bold text-warning-700 uppercase tracking-wide mb-2 pl-1">
              ⚠️ {language === 'tr' ? 'Beklenmeyen Ürünler' : 'Unexpected Products'}
            </div>
            <div className="flex flex-col gap-3">
              {unexpectedItems.map((item, index) => (
                <div key={index} className="bg-warning-50 rounded-lg p-3 shadow-xs border-l-[3px] border-l-warning-500">
                  <div className="flex flex-col gap-1 mb-3">
                    <span className="font-semibold text-slate-800 text-[0.9375rem]">{item.product_name}</span>
                    <span className="text-xs text-slate-500">{item.sku_code}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-lg font-bold font-mono text-warning-700">
                      {item.counted_quantity}x
                    </span>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg bg-success-100 text-success-600">
                      +{item.counted_quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No items yet */}
        {currentLocationItems.length === 0 && unexpectedItems.length === 0 && (
          <div className="text-center py-8 px-4 text-warning-700 italic">
            {language === 'tr'
              ? 'Boş lokasyon - ürün tarayın veya sonraki lokasyona geçin'
              : 'Empty location - scan products or move to next'}
          </div>
        )}

        {/* Count Summary for Current Location */}
        <div className="bg-white rounded-lg p-3 mt-4">
          <div className="flex justify-between py-1 text-sm">
            <span>{language === 'tr' ? 'Beklenen' : 'Expected'}:</span>
            <span>
              {currentLocationItems.reduce((sum, item) => sum + item.expected_quantity, 0)}
            </span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span>{language === 'tr' ? 'Sayılan' : 'Counted'}:</span>
            <span>
              {currentLocationItems.reduce((sum, item) => sum + item.counted_quantity, 0) +
                unexpectedItems.reduce((sum, item) => sum + item.counted_quantity, 0)}
            </span>
          </div>
          <div className="flex justify-between py-1 text-sm border-t border-slate-200 pt-2 mt-1 font-bold">
            <span>{language === 'tr' ? 'Fark' : 'Variance'}:</span>
            <span
              className={(() => {
                const variance =
                  currentLocationItems.reduce((sum, item) => sum + item.variance, 0) +
                  unexpectedItems.reduce((sum, item) => sum + item.counted_quantity, 0);
                return variance > 0 ? 'text-success-600' : variance < 0 ? 'text-error-600' : '';
              })()}
            >
              {(() => {
                const variance =
                  currentLocationItems.reduce((sum, item) => sum + item.variance, 0) +
                  unexpectedItems.reduce((sum, item) => sum + item.counted_quantity, 0);
                return variance > 0 ? `+${variance}` : variance;
              })()}
            </span>
          </div>
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t-2 border-warning-200">
          <button
            onClick={onSaveLocation}
            className="flex-1 min-w-[80px] py-3 px-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-success-500 text-white hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            ✓ {translations.countSaveLocation}
          </button>
          <button onClick={onCancel} className="flex-[0.5] min-w-[80px] py-3 px-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-slate-500 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
            ✕ {translations.cancel}
          </button>
        </div>
      </div>

      {/* Completed Locations Counter */}
      {countState.completedLocations.length > 0 && (
        <div className="px-4 py-3 bg-success-100 mx-4 mb-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-success-700">
              ✓ {countState.completedLocations.length} {translations.countTotalLocations}
            </span>
            <button onClick={onShowSummary} className="bg-success-600 text-white border-none px-4 py-2 rounded-lg font-semibold cursor-pointer text-sm hover:bg-success-700">
              📊 {translations.countSummary}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
