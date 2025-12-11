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
      <div className="mode-buttons">
        {availableModes.map((mode) => (
          <button
            key={mode.mode_id}
            onClick={() => onSelectMode(mode)}
            className="mode-btn"
            style={{ backgroundColor: getModeColor(mode.mode_code) }}
          >
            {getModeDisplayName(mode.mode_code, language)}
          </button>
        ))}
      </div>
      <div className="container-mode-section">
        <div className="section-label">{translations.createContainer}</div>
        <div className="container-mode-buttons">
          <button
            onClick={() => onStartContainerMode('BOX')}
            className="container-mode-btn box"
          >
            📦 {translations.newBox}
          </button>
          <button
            onClick={() => onStartContainerMode('PALLET')}
            className="container-mode-btn pallet"
          >
            📋 {translations.newPallet}
          </button>
        </div>
      </div>
    </>
  );
}
