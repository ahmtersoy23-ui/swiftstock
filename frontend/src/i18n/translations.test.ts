import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { translations, useTranslation } from './translations';
import { useStore } from '../stores/appStore';

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
  beforeEach(() => {
    act(() => {
      useStore.getState().setLanguage('tr');
    });
  });

  it('returns a t function and language', () => {
    const { result } = renderHook(() => useTranslation());
    expect(typeof result.current.t).toBe('function');
    expect(result.current.language).toBe('tr');
  });

  it('translates known keys in Turkish', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('home')).toBe('Ana Sayfa');
    expect(result.current.t('operations')).toBe('Operasyonlar');
  });

  it('returns the key itself for unknown keys', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('switches to English when store language changes', () => {
    const { result, rerender } = renderHook(() => useTranslation());
    expect(result.current.t('home')).toBe('Ana Sayfa');

    act(() => {
      useStore.getState().setLanguage('en');
    });
    rerender();

    expect(result.current.language).toBe('en');
    expect(result.current.t('home')).toBe('Home');
  });
});
