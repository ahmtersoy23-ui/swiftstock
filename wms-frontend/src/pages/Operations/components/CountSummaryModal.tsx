// Count summary modal component
import type { CountState } from '../types';

interface CountSummaryModalProps {
  countState: CountState;
  loading: boolean;
  onComplete: () => void;
  onContinue: () => void;
  onCancel: () => void;
  translations: {
    countSummary: string;
    countTotalLocations: string;
    countTotalProducts: string;
    countTotalVariance: string;
    countLocationVariances: string;
    countNoVariance: string;
    countComplete: string;
    countNextLocation: string;
    cancel: string;
  };
}

export function CountSummaryModal({
  countState,
  loading,
  onComplete,
  onContinue,
  onCancel,
  translations,
}: CountSummaryModalProps) {
  if (!countState.showSummary) return null;

  const { completedLocations } = countState;

  return (
    <div className="count-summary-overlay">
      <div className="count-summary-modal">
        <h3>📊 {translations.countSummary}</h3>

        <div className="summary-totals">
          <div className="summary-stat">
            <span className="stat-label">{translations.countTotalLocations}</span>
            <span className="stat-value">{completedLocations.length}</span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">{translations.countTotalProducts}</span>
            <span className="stat-value">
              {completedLocations.reduce((sum, loc) => sum + loc.items.length, 0)}
            </span>
          </div>
          <div className="summary-stat">
            <span className="stat-label">{translations.countTotalVariance}</span>
            <span
              className={`stat-value ${
                completedLocations.reduce((sum, loc) => sum + loc.totalVariance, 0) !== 0
                  ? 'has-variance'
                  : ''
              }`}
            >
              {completedLocations.reduce((sum, loc) => sum + loc.totalVariance, 0)}
            </span>
          </div>
        </div>

        <div className="summary-locations">
          <h4>{translations.countLocationVariances}</h4>
          {completedLocations.map((loc, index) => (
            <div key={index} className="summary-location">
              <div className="summary-location-header">
                <span>📍 {loc.location.location_code}</span>
                <span
                  className={`variance-badge ${
                    loc.totalVariance > 0
                      ? 'positive'
                      : loc.totalVariance < 0
                      ? 'negative'
                      : 'zero'
                  }`}
                >
                  {loc.totalVariance === 0
                    ? translations.countNoVariance
                    : loc.totalVariance > 0
                    ? `+${loc.totalVariance}`
                    : loc.totalVariance}
                </span>
              </div>
              {/* Expected items with variance */}
              {loc.items
                .filter((item) => item.variance !== 0)
                .map((item, itemIndex) => (
                  <div key={`exp-${itemIndex}`} className="summary-item">
                    <span>{item.product_name}</span>
                    <span className={item.variance > 0 ? 'positive' : 'negative'}>
                      {item.variance > 0 ? '+' : ''}
                      {item.variance}
                    </span>
                  </div>
                ))}
              {/* Unexpected items */}
              {loc.unexpectedItems &&
                loc.unexpectedItems.map((item, itemIndex) => (
                  <div key={`unexp-${itemIndex}`} className="summary-item unexpected">
                    <span>⚠️ {item.product_name}</span>
                    <span className="positive">+{item.counted_quantity}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>

        <div className="summary-actions">
          <button onClick={onComplete} className="action-btn complete" disabled={loading}>
            ✓ {translations.countComplete}
          </button>
          <button onClick={onContinue} className="action-btn secondary">
            ← {translations.countNextLocation}
          </button>
          <button onClick={onCancel} className="action-btn cancel">
            ✕ {translations.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
