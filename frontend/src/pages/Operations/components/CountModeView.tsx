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
      <div className="count-inventory-list">
        <div className="count-header">
          <span>📋 {location.location_code}</span>
          <span className="count-scan-hint">
            {language === 'tr'
              ? '📦 Ürün tarayın (1 barkod = 1 adet)'
              : '📦 Scan products (1 barcode = 1 item)'}
          </span>
        </div>

        {/* Expected Items with Progress */}
        {currentLocationItems.length > 0 && (
          <div className="count-section">
            <div className="count-section-title">
              {language === 'tr' ? 'Beklenen Ürünler' : 'Expected Products'}
            </div>
            <div className="count-items">
              {currentLocationItems.map((item, index) => {
                const isComplete = item.counted_quantity >= item.expected_quantity;
                const isOverCount = item.counted_quantity > item.expected_quantity;
                return (
                  <div
                    key={index}
                    className={`count-item-row ${isComplete ? 'complete' : ''} ${
                      isOverCount ? 'over' : ''
                    }`}
                  >
                    <div className="count-item-info">
                      <span className="count-item-name">{item.product_name}</span>
                      <span className="count-item-sku">{item.sku_code}</span>
                    </div>
                    <div className="count-item-progress">
                      <span
                        className={`count-progress-text ${isComplete ? 'complete' : ''} ${
                          isOverCount ? 'over' : ''
                        }`}
                      >
                        {item.counted_quantity} / {item.expected_quantity}
                      </span>
                      {item.variance !== 0 && (
                        <span
                          className={`count-variance-badge ${
                            item.variance > 0 ? 'positive' : 'negative'
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
          <div className="count-section unexpected">
            <div className="count-section-title warning">
              ⚠️ {language === 'tr' ? 'Beklenmeyen Ürünler' : 'Unexpected Products'}
            </div>
            <div className="count-items">
              {unexpectedItems.map((item, index) => (
                <div key={index} className="count-item-row unexpected">
                  <div className="count-item-info">
                    <span className="count-item-name">{item.product_name}</span>
                    <span className="count-item-sku">{item.sku_code}</span>
                  </div>
                  <div className="count-item-progress">
                    <span className="count-progress-text unexpected">
                      {item.counted_quantity}x
                    </span>
                    <span className="count-variance-badge positive">
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
          <div className="count-empty-hint">
            {language === 'tr'
              ? 'Boş lokasyon - ürün tarayın veya sonraki lokasyona geçin'
              : 'Empty location - scan products or move to next'}
          </div>
        )}

        {/* Count Summary for Current Location */}
        <div className="count-location-summary">
          <div className="summary-row">
            <span>{language === 'tr' ? 'Beklenen' : 'Expected'}:</span>
            <span>
              {currentLocationItems.reduce((sum, item) => sum + item.expected_quantity, 0)}
            </span>
          </div>
          <div className="summary-row">
            <span>{language === 'tr' ? 'Sayılan' : 'Counted'}:</span>
            <span>
              {currentLocationItems.reduce((sum, item) => sum + item.counted_quantity, 0) +
                unexpectedItems.reduce((sum, item) => sum + item.counted_quantity, 0)}
            </span>
          </div>
          <div className="summary-row variance">
            <span>{language === 'tr' ? 'Fark' : 'Variance'}:</span>
            <span
              className={(() => {
                const variance =
                  currentLocationItems.reduce((sum, item) => sum + item.variance, 0) +
                  unexpectedItems.reduce((sum, item) => sum + item.counted_quantity, 0);
                return variance > 0 ? 'positive' : variance < 0 ? 'negative' : '';
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

        <div className="count-actions">
          <button
            onClick={onSaveLocation}
            className="action-btn complete"
            disabled={loading}
          >
            ✓ {translations.countSaveLocation}
          </button>
          <button onClick={onCancel} className="action-btn cancel" disabled={loading}>
            ✕ {translations.cancel}
          </button>
        </div>
      </div>

      {/* Completed Locations Counter */}
      {countState.completedLocations.length > 0 && (
        <div className="count-progress">
          <div className="count-progress-info">
            <span>
              ✓ {countState.completedLocations.length} {translations.countTotalLocations}
            </span>
            <button onClick={onShowSummary} className="summary-btn">
              📊 {translations.countSummary}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
