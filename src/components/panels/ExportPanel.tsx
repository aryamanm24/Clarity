'use client';

import { fonts } from '@/lib/design-tokens';
import type { GraphState } from '@/lib/types';

interface ExportPanelProps {
  graphState: GraphState;
  onClose: () => void;
}

export const ExportPanel = ({ graphState, onClose }: ExportPanelProps) => {
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(graphState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clarity-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-clarity-text" style={{ fontFamily: fonts.system }}>
          Export Analysis
        </h3>
        <button
          onClick={onClose}
          className="text-clarity-text-muted hover:text-clarity-text transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleExportJSON}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs hover:bg-clarity-surface-hover transition-colors"
        >
          <span className="font-medium text-clarity-text">Export as JSON</span>
          <br />
          <span className="text-clarity-text-muted">Full analysis data</span>
        </button>

        {/* TODO: Add more export formats */}
        <button
          disabled
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs opacity-50 cursor-not-allowed"
        >
          <span className="font-medium text-clarity-text">Export as PDF</span>
          <br />
          <span className="text-clarity-text-muted">Coming soon</span>
        </button>
      </div>
    </div>
  );
};
