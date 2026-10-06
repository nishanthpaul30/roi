'use client';

import { useState } from 'react';
import { useMetricsData } from '@/hooks/useMetricsData';
import { GlobalFilterBar } from '@/components/layout/GlobalFilterBar';
import { MultiToolComparisonPanel } from '@/components/ui/MultiToolComparisonPanel';
import { ExecutiveInferenceDrilldownView } from '@/components/ui/ExecutiveInferenceDrilldownView';

// Relocated here from the Executive Overview page — the "Deep Dive" and
// per-tool / per-user click paths still open the same multi_tool_comparison
// inference drilldown, wired up exactly as it was there.
export default function MultiToolComparisonPage() {
  const { filters, setFilters, data, loading } = useMetricsData();
  const [activeInferenceDrilldown, setActiveInferenceDrilldown] = useState<string | null>(null);
  const [inferenceInitialEntity, setInferenceInitialEntity] = useState<{
    type: 'user' | 'tool' | 'region' | 'country' | 'service_line' | 'project_code' | 'cohort' | 'month';
    name: string;
    label?: string;
  } | null>(null);

  return (
    <div className="flex-1 flex flex-col">
      <GlobalFilterBar filters={filters} onFilterChange={setFilters} filterOptions={data?.filterOptions} />

      <main className="p-6 space-y-6 w-full">
        {activeInferenceDrilldown ? (
          <ExecutiveInferenceDrilldownView
            inferenceId={activeInferenceDrilldown}
            summary={data?.tokenCostSummary}
            initialEntity={inferenceInitialEntity}
            onBack={() => {
              setActiveInferenceDrilldown(null);
              setInferenceInitialEntity(null);
            }}
            filters={filters}
          />
        ) : (
          <>
            {/* Header Title Block */}

            {loading || !data ? (
              <div className="h-64 flex items-center justify-center text-ey-muted text-sm animate-pulse">
                Loading data...
              </div>
            ) : (
              <MultiToolComparisonPanel
                summary={data.tokenCostSummary}
                onDrilldown={(tool, userMail) => {
                  if (userMail) {
                    setInferenceInitialEntity({ type: 'user', name: userMail, label: userMail });
                  } else if (tool) {
                    const TOOL_ENTERPRISE_LABELS: Record<string, string> = {
                      chatgpt: 'ChatGPT Enterprise',
                      github: 'GitHub Copilot Enterprise',
                      claude: 'Claude Enterprise',
                      replit: 'Replit Enterprise',
                      factory: 'Factory AI Enterprise',
                      cursor: 'Cursor AI Enterprise',
                    };
                    const toolLabel = TOOL_ENTERPRISE_LABELS[tool.toLowerCase()] || tool;
                    setInferenceInitialEntity({ type: 'tool', name: tool, label: toolLabel });
                  } else {
                    setInferenceInitialEntity(null);
                  }
                  setActiveInferenceDrilldown('multi_tool_comparison');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
