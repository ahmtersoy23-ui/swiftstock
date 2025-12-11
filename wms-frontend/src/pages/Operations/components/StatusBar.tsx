// Workflow status bar component
import { getModeColor, getModeDisplayName } from '../utils/helpers';
import type { WorkflowState } from '../types';

interface StatusBarProps {
  workflow: WorkflowState;
  language: 'tr' | 'en';
  translations: {
    items: string;
  };
}

export function StatusBar({ workflow, language, translations }: StatusBarProps) {
  if (!workflow.mode) return null;

  const totalItems = workflow.items.length;

  return (
    <div
      className="workflow-status"
      style={{ backgroundColor: getModeColor(workflow.mode.mode_code) }}
    >
      <div className="status-row">
        <span className="status-mode">
          {getModeDisplayName(workflow.mode.mode_code, language)}
        </span>
        {workflow.location && (
          <span className="status-location">📍 {workflow.location.location_code}</span>
        )}
      </div>
      {workflow.items.length > 0 && (
        <div className="status-count">
          {totalItems} {translations.items}
        </div>
      )}
    </div>
  );
}
