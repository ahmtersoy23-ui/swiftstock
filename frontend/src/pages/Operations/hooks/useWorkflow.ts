// Workflow state management hook
import { useState, useRef, useCallback } from 'react';
import type { WorkflowState, ScannedItem } from '../types';
import { initialWorkflowState } from '../types';

export function useWorkflow() {
  const [workflow, setWorkflow] = useState<WorkflowState>(initialWorkflowState);
  const workflowRef = useRef(workflow);

  // Keep ref in sync
  workflowRef.current = workflow;

  const setMode = useCallback((mode: WorkflowState['mode']) => {
    setWorkflow({ step: 'MODE_SELECTED', mode, location: null, items: [] });
  }, []);

  const setLocation = useCallback((location: WorkflowState['location']) => {
    setWorkflow((prev) => ({ ...prev, location, step: 'LOCATION_SET' }));
  }, []);

  const setScanning = useCallback(() => {
    setWorkflow((prev) => ({ ...prev, step: 'SCANNING' }));
  }, []);

  const addItem = useCallback((item: ScannedItem) => {
    setWorkflow((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setWorkflow((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }, []);

  const clearItems = useCallback(() => {
    setWorkflow((prev) => ({ ...prev, items: [] }));
  }, []);

  const reset = useCallback(() => {
    setWorkflow(initialWorkflowState);
  }, []);

  return {
    workflow,
    workflowRef,
    setWorkflow,
    setMode,
    setLocation,
    setScanning,
    addItem,
    removeItem,
    clearItems,
    reset,
  };
}
