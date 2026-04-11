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
      className="px-4 py-3 text-white flex justify-between items-center"
      style={{ backgroundColor: getModeColor(workflow.mode.mode_code) }}
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-base">
          {getModeDisplayName(workflow.mode.mode_code, language)}
        </span>
        {workflow.location && (
          <span className="text-sm opacity-95 bg-white/20 px-3 py-1 rounded-lg">📍 {workflow.location.location_code}</span>
        )}
      </div>
      {workflow.items.length > 0 && (
        <div className="font-bold text-lg bg-white/25 py-2 px-4 rounded-lg">
          {totalItems} {translations.items}
        </div>
      )}
    </div>
  );
}
