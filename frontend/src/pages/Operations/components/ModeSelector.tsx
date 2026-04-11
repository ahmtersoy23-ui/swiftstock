// Mode selection buttons component
import type { OperationMode } from '../../../types';
import { getModeColor, getModeDisplayName } from '../utils/helpers';

interface ModeSelectorProps {
  availableModes: OperationMode[];
  onSelectMode: (mode: OperationMode) => void;
  onStartContainerMode: (type: 'BOX' | 'PALLET') => void;
  language: 'tr' | 'en';
  translations: {
    createContainer: string;
    newBox: string;
    newPallet: string;
  };
}

export function ModeSelector({
  availableModes,
  onSelectMode,
  onStartContainerMode,
  language,
  translations,
}: ModeSelectorProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-4 pb-4 pt-2">
        {availableModes.map((mode) => (
          <button
            key={mode.mode_id}
            onClick={() => onSelectMode(mode)}
            className="py-4 px-3 border-none rounded-xl text-white font-semibold text-[0.9375rem] cursor-pointer duration-150 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            style={{ backgroundColor: getModeColor(mode.mode_code) }}
          >
            {getModeDisplayName(mode.mode_code, language)}
          </button>
        ))}
      </div>
      <div className="px-4 pb-4 border-t border-dashed border-slate-200 mt-2 pt-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-3 font-semibold text-center">{translations.createContainer}</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onStartContainerMode('BOX')}
            className="p-3 border-2 border-dashed border-warning-500 text-warning-700 rounded-xl font-semibold text-[0.9375rem] cursor-pointer duration-150 bg-white flex items-center justify-center gap-2 hover:bg-warning-50 hover:border-solid hover:-translate-y-0.5"
          >
            📦 {translations.newBox}
          </button>
          <button
            onClick={() => onStartContainerMode('PALLET')}
            className="p-3 border-2 border-dashed border-info-500 text-info-700 rounded-xl font-semibold text-[0.9375rem] cursor-pointer duration-150 bg-white flex items-center justify-center gap-2 hover:bg-info-50 hover:border-solid hover:-translate-y-0.5"
          >
            📋 {translations.newPallet}
          </button>
        </div>
      </div>
    </>
  );
}
