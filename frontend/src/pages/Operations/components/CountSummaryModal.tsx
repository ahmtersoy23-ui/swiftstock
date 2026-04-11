// Count summary modal component
import type { CountState } from '../types';
import { Modal, ModalBody, ModalFooter } from '../../../shared/components/Modal';

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
  const { completedLocations } = countState;

  return (
    <Modal isOpen={countState.showSummary} onClose={onCancel} size="xl">
      <h3 className="p-4 m-0 bg-info-600 text-white text-lg rounded-t-xl">📊 {translations.countSummary}</h3>

      <div className="grid grid-cols-3 gap-3 p-4 bg-info-50">
        <div className="text-center p-3 bg-white rounded-lg shadow-xs">
          <span className="block text-[0.6875rem] text-slate-500 uppercase font-semibold tracking-wide mb-1">{translations.countTotalLocations}</span>
          <span className="text-[1.375rem] font-extrabold text-slate-800">{completedLocations.length}</span>
        </div>
        <div className="text-center p-3 bg-white rounded-lg shadow-xs">
          <span className="block text-[0.6875rem] text-slate-500 uppercase font-semibold tracking-wide mb-1">{translations.countTotalProducts}</span>
          <span className="text-[1.375rem] font-extrabold text-slate-800">
            {completedLocations.reduce((sum, loc) => sum + loc.items.length, 0)}
          </span>
        </div>
        <div className="text-center p-3 bg-white rounded-lg shadow-xs">
          <span className="block text-[0.6875rem] text-slate-500 uppercase font-semibold tracking-wide mb-1">{translations.countTotalVariance}</span>
          <span
            className={`text-[1.375rem] font-extrabold ${
              completedLocations.reduce((sum, loc) => sum + loc.totalVariance, 0) !== 0
                ? 'text-error-600'
                : 'text-slate-800'
            }`}
          >
            {completedLocations.reduce((sum, loc) => sum + loc.totalVariance, 0)}
          </span>
        </div>
      </div>

      <ModalBody>
        <h4 className="m-0 mb-3 text-slate-600 text-sm">{translations.countLocationVariances}</h4>
        {completedLocations.map((loc, index) => (
          <div key={index} className="bg-slate-100 rounded-lg p-3 mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-slate-800">📍 {loc.location.location_code}</span>
              <span
                className={`px-3 py-1 rounded-full text-[0.8125rem] font-bold ${
                  loc.totalVariance > 0
                    ? 'bg-success-100 text-success-600'
                    : loc.totalVariance < 0
                    ? 'bg-error-100 text-error-600'
                    : 'bg-success-50 text-success-700'
                }`}
              >
                {loc.totalVariance === 0
                  ? translations.countNoVariance
                  : loc.totalVariance > 0
                  ? `+${loc.totalVariance}`
                  : loc.totalVariance}
              </span>
            </div>
            {loc.items
              .filter((item) => item.variance !== 0)
              .map((item, itemIndex) => (
                <div key={`exp-${itemIndex}`} className="flex justify-between px-3 py-2 bg-white rounded-md mt-2 text-sm">
                  <span>{item.product_name}</span>
                  <span className={`font-semibold ${item.variance > 0 ? 'text-success-600' : 'text-error-600'}`}>
                    {item.variance > 0 ? '+' : ''}
                    {item.variance}
                  </span>
                </div>
              ))}
            {loc.unexpectedItems &&
              loc.unexpectedItems.map((item, itemIndex) => (
                <div key={`unexp-${itemIndex}`} className="flex justify-between px-3 py-2 bg-warning-100 rounded-md mt-2 text-sm">
                  <span className="text-warning-700">⚠️ {item.product_name}</span>
                  <span className="text-success-600 font-semibold">+{item.counted_quantity}</span>
                </div>
              ))}
          </div>
        ))}
      </ModalBody>

      <ModalFooter>
        <button onClick={onComplete} className="flex-1 min-w-[80px] py-3 px-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-success-500 text-white hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>
          ✓ {translations.countComplete}
        </button>
        <button onClick={onContinue} className="flex-1 min-w-[80px] py-3 px-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-slate-500 text-white hover:bg-slate-600">
          ← {translations.countNextLocation}
        </button>
        <button onClick={onCancel} className="flex-[0.5] min-w-[80px] py-3 px-3 border-none rounded-lg font-medium text-[0.9375rem] cursor-pointer duration-150 flex items-center justify-center gap-1 bg-slate-500 text-white hover:bg-slate-600">
          ✕ {translations.cancel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
