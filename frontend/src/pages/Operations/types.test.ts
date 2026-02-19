import { describe, it, expect } from 'vitest';
import { initialWorkflowState, initialCountState } from './types';

describe('initialWorkflowState', () => {
  it('starts in IDLE step', () => {
    expect(initialWorkflowState.step).toBe('IDLE');
  });

  it('has null mode', () => {
    expect(initialWorkflowState.mode).toBeNull();
  });

  it('has null location', () => {
    expect(initialWorkflowState.location).toBeNull();
  });

  it('has empty items array', () => {
    expect(initialWorkflowState.items).toEqual([]);
    expect(Array.isArray(initialWorkflowState.items)).toBe(true);
  });
});

describe('initialCountState', () => {
  it('starts as not active', () => {
    expect(initialCountState.isActive).toBe(false);
  });

  it('has empty current location items', () => {
    expect(initialCountState.currentLocationItems).toEqual([]);
  });

  it('has empty unexpected items', () => {
    expect(initialCountState.unexpectedItems).toEqual([]);
  });

  it('has empty completed locations', () => {
    expect(initialCountState.completedLocations).toEqual([]);
  });

  it('has summary hidden', () => {
    expect(initialCountState.showSummary).toBe(false);
  });
});
