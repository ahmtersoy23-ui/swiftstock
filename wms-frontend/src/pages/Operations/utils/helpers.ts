// Helper utilities for Operations page
import { translations } from '../../../i18n/translations';

export const getModeColor = (code: string): string => {
  const colors: Record<string, string> = {
    'MODE-IN-RECEIVING': '#10b981',
    'MODE-OUT-PICKING': '#f59e0b',
    'MODE-MOVE-TRANSFER': '#3b82f6',
    'MODE-COUNT-CYCLE': '#8b5cf6',
    'CONTAINER-BOX': '#d97706',
    'CONTAINER-PALLET': '#7c3aed',
  };
  return colors[code] || '#6b7280';
};

export const getModeDisplayName = (code: string, lang: 'tr' | 'en'): string => {
  const t = translations[lang];
  const names: Record<string, string> = {
    'MODE-IN-RECEIVING': `📥 ${t.receiving}`,
    'MODE-OUT-PICKING': `📤 ${t.picking}`,
    'MODE-MOVE-TRANSFER': `🔄 ${t.transfer}`,
    'MODE-COUNT-CYCLE': `📋 ${t.count}`,
    'CONTAINER-BOX': `📦 ${t.newBox}`,
    'CONTAINER-PALLET': `📋 ${t.newPallet}`,
  };
  return names[code] || code;
};

// Debounce constants
export const DEBOUNCE_MODE_LOCATION = 3000;
export const DEBOUNCE_PRODUCT = 800;
export const DEBOUNCE_DEFAULT = 1500;
export const SCAN_COOLDOWN_MS = 500;
export const SCANNER_STARTUP_DELAY = 1000;
export const MAX_RETRY = 3;
