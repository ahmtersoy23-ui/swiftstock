import { describe, it, expect } from 'vitest';
import { translations, useTranslation } from './translations';

describe('translations', () => {
  it('has both tr and en language objects', () => {
    expect(translations).toHaveProperty('tr');
    expect(translations).toHaveProperty('en');
  });

  it('has the same keys in both languages', () => {
    const trKeys = Object.keys(translations.tr).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(trKeys).toEqual(enKeys);
  });

  it('has non-empty string values for all Turkish translations', () => {
    for (const [key, value] of Object.entries(translations.tr)) {
      expect(typeof value).toBe('string');
      expect(value.length, `Turkish key "${key}" should not be empty`).toBeGreaterThan(0);
    }
  });

  it('has non-empty string values for all English translations', () => {
    for (const [key, value] of Object.entries(translations.en)) {
      expect(typeof value).toBe('string');
      expect(value.length, `English key "${key}" should not be empty`).toBeGreaterThan(0);
    }
  });

  it('contains essential navigation keys', () => {
    const requiredKeys = ['home', 'operations', 'inventory', 'products', 'locations'];
    for (const key of requiredKeys) {
      expect(translations.tr).toHaveProperty(key);
      expect(translations.en).toHaveProperty(key);
    }
  });

  it('contains essential operation mode keys', () => {
    const requiredKeys = ['receiving', 'picking', 'transfer', 'count'];
    for (const key of requiredKeys) {
      expect(translations.tr).toHaveProperty(key);
      expect(translations.en).toHaveProperty(key);
    }
  });

  it('contains essential error message keys', () => {
    const requiredKeys = [
      'errorNotFound',
      'errorUnknownBarcode',
      'errorScanFailed',
      'errorSelectModeFirst',
      'errorScanLocationFirst',
    ];
    for (const key of requiredKeys) {
      expect(translations.tr).toHaveProperty(key);
      expect(translations.en).toHaveProperty(key);
    }
  });
});

describe('useTranslation', () => {
  it('returns a t function and language', () => {
    const { t, language } = useTranslation();
    expect(typeof t).toBe('function');
    expect(language).toBe('tr');
  });

  it('translates known keys in Turkish', () => {
    const { t } = useTranslation();
    expect(t('home')).toBe('Ana Sayfa');
    expect(t('operations')).toBe('Operasyonlar');
  });

  it('returns the key itself for unknown keys', () => {
    const { t } = useTranslation();
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });
});
