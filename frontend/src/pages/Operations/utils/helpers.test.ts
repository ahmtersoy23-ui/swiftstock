import { describe, it, expect } from 'vitest';
import {
  getModeColor,
  getModeDisplayName,
  DEBOUNCE_MODE_LOCATION,
  DEBOUNCE_PRODUCT,
  DEBOUNCE_DEFAULT,
  SCAN_COOLDOWN_MS,
  SCANNER_STARTUP_DELAY,
  MAX_RETRY,
} from './helpers';

describe('getModeColor', () => {
  it('returns green for IN mode', () => {
    expect(getModeColor('IN')).toBe('#10b981');
  });

  it('returns amber for OUT mode', () => {
    expect(getModeColor('OUT')).toBe('#f59e0b');
  });

  it('returns blue for TRANSFER mode', () => {
    expect(getModeColor('TRANSFER')).toBe('#3b82f6');
  });

  it('returns purple for COUNT mode', () => {
    expect(getModeColor('COUNT')).toBe('#8b5cf6');
  });

  it('returns correct color for legacy mode codes', () => {
    expect(getModeColor('MODE-IN-RECEIVING')).toBe('#10b981');
    expect(getModeColor('MODE-OUT-PICKING')).toBe('#f59e0b');
    expect(getModeColor('MODE-MOVE-TRANSFER')).toBe('#3b82f6');
    expect(getModeColor('MODE-COUNT-CYCLE')).toBe('#8b5cf6');
  });

  it('returns correct color for container codes', () => {
    expect(getModeColor('CONTAINER-BOX')).toBe('#d97706');
    expect(getModeColor('CONTAINER-PALLET')).toBe('#7c3aed');
  });

  it('returns default gray for unknown codes', () => {
    expect(getModeColor('UNKNOWN')).toBe('#6b7280');
    expect(getModeColor('')).toBe('#6b7280');
    expect(getModeColor('RANDOM-CODE')).toBe('#6b7280');
  });
});

describe('getModeDisplayName', () => {
  it('returns Turkish display name for IN mode', () => {
    const result = getModeDisplayName('IN', 'tr');
    expect(result).toContain('Mal Kabul');
  });

  it('returns English display name for IN mode', () => {
    const result = getModeDisplayName('IN', 'en');
    expect(result).toContain('Receiving');
  });

  it('returns Turkish display name for OUT mode', () => {
    const result = getModeDisplayName('OUT', 'tr');
    expect(result).toContain('Mal');
  });

  it('returns English display name for OUT mode', () => {
    const result = getModeDisplayName('OUT', 'en');
    expect(result).toContain('Picking');
  });

  it('returns Turkish display name for TRANSFER mode', () => {
    const result = getModeDisplayName('TRANSFER', 'tr');
    expect(result).toContain('Transfer');
  });

  it('returns English display name for COUNT mode', () => {
    const result = getModeDisplayName('COUNT', 'en');
    expect(result).toContain('Count');
  });

  it('handles legacy mode codes in Turkish', () => {
    const result = getModeDisplayName('MODE-IN-RECEIVING', 'tr');
    expect(result).toContain('Mal Kabul');
  });

  it('handles container codes', () => {
    const trBox = getModeDisplayName('CONTAINER-BOX', 'tr');
    expect(trBox).toContain('Koli');

    const enBox = getModeDisplayName('CONTAINER-BOX', 'en');
    expect(enBox).toContain('Box');
  });

  it('returns the code itself for unknown codes', () => {
    expect(getModeDisplayName('UNKNOWN', 'tr')).toBe('UNKNOWN');
    expect(getModeDisplayName('UNKNOWN', 'en')).toBe('UNKNOWN');
  });
});

describe('constants', () => {
  it('has correct debounce values', () => {
    expect(DEBOUNCE_MODE_LOCATION).toBe(3000);
    expect(DEBOUNCE_PRODUCT).toBe(800);
    expect(DEBOUNCE_DEFAULT).toBe(1500);
  });

  it('has correct scanner values', () => {
    expect(SCAN_COOLDOWN_MS).toBe(500);
    expect(SCANNER_STARTUP_DELAY).toBe(1000);
  });

  it('has correct retry limit', () => {
    expect(MAX_RETRY).toBe(3);
  });
});
