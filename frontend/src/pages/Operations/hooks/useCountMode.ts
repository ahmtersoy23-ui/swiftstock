// Count mode state management hook
import { useState, useCallback } from 'react';
import type { CountState, CountItem, CountLocationResult } from '../types';
import type { Location } from '../../../types';
import { initialCountState } from '../types';

export function useCountMode() {
  const [countState, setCountState] = useState<CountState>(initialCountState);

  const startCountMode = useCallback(() => {
    setCountState({
      isActive: true,
      currentLocationItems: [],
      unexpectedItems: [],
      completedLocations: [],
      showSummary: false,
    });
  }, []);

  const setLocationItems = useCallback((items: CountItem[]) => {
    setCountState((prev) => ({
      ...prev,
      currentLocationItems: items,
      unexpectedItems: [],
    }));
  }, []);

  const incrementExpectedItem = useCallback((skuCode: string, barcode: string) => {
    setCountState((prev) => ({
      ...prev,
      currentLocationItems: prev.currentLocationItems.map((item) => {
        if (item.sku_code === skuCode) {
          const newCount = item.counted_quantity + 1;
          return {
            ...item,
            counted_quantity: newCount,
            variance: newCount - item.expected_quantity,
            scanned_barcodes: [...item.scanned_barcodes, barcode],
          };
        }
        return item;
      }),
    }));
  }, []);

  const incrementUnexpectedItem = useCallback((skuCode: string, barcode: string) => {
    setCountState((prev) => ({
      ...prev,
      unexpectedItems: prev.unexpectedItems.map((item) => {
        if (item.sku_code === skuCode) {
          const newCount = item.counted_quantity + 1;
          return {
            ...item,
            counted_quantity: newCount,
            variance: newCount,
            scanned_barcodes: [...item.scanned_barcodes, barcode],
          };
        }
        return item;
      }),
    }));
  }, []);

  const addUnexpectedItem = useCallback((item: CountItem) => {
    setCountState((prev) => ({
      ...prev,
      unexpectedItems: [...prev.unexpectedItems, item],
    }));
  }, []);

  const saveLocationCount = useCallback((location: Location) => {
    const { currentLocationItems, unexpectedItems } = countState;

    const totalExpected = currentLocationItems.reduce(
      (sum, item) => sum + item.expected_quantity,
      0
    );
    const totalCounted =
      currentLocationItems.reduce((sum, item) => sum + item.counted_quantity, 0) +
      unexpectedItems.reduce((sum, item) => sum + item.counted_quantity, 0);
    const totalVariance = totalCounted - totalExpected;

    const locationResult: CountLocationResult = {
      location,
      items: [...currentLocationItems],
      unexpectedItems: [...unexpectedItems],
      totalExpected,
      totalCounted,
      totalVariance,
    };

    setCountState((prev) => ({
      ...prev,
      completedLocations: [...prev.completedLocations, locationResult],
      currentLocationItems: [],
      unexpectedItems: [],
    }));

    return locationResult;
  }, [countState]);

  const showSummary = useCallback(() => {
    setCountState((prev) => ({ ...prev, showSummary: true }));
  }, []);

  const hideSummary = useCallback(() => {
    setCountState((prev) => ({ ...prev, showSummary: false }));
  }, []);

  const reset = useCallback(() => {
    setCountState(initialCountState);
  }, []);

  const isAlreadyScanned = useCallback(
    (barcode: string) => {
      const inExpected = countState.currentLocationItems.some((item) =>
        item.scanned_barcodes.includes(barcode)
      );
      const inUnexpected = countState.unexpectedItems.some((item) =>
        item.scanned_barcodes.includes(barcode)
      );
      return inExpected || inUnexpected;
    },
    [countState]
  );

  const findExpectedItem = useCallback(
    (skuCode: string) => {
      return countState.currentLocationItems.find((item) => item.sku_code === skuCode);
    },
    [countState]
  );

  const findUnexpectedItem = useCallback(
    (skuCode: string) => {
      return countState.unexpectedItems.find((item) => item.sku_code === skuCode);
    },
    [countState]
  );

  return {
    countState,
    setCountState,
    startCountMode,
    setLocationItems,
    incrementExpectedItem,
    incrementUnexpectedItem,
    addUnexpectedItem,
    saveLocationCount,
    showSummary,
    hideSummary,
    reset,
    isAlreadyScanned,
    findExpectedItem,
    findUnexpectedItem,
  };
}
