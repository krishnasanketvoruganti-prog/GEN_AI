import type { WorkbenchTab } from "../types/augmentation.ts";

interface TopNavProps {
  activeTab: WorkbenchTab;
  onSelectTab: (tab: WorkbenchTab) => void;
  batchCount: number;
  onExportDataset: () => void;
}

const NAV_ITEMS: { id: WorkbenchTab; label: string }[] = [
  { id: "studio", label: "Pipeline Studio" },
  { id: "batch_qa", label: "Batch & QA Filter" },
  { id: "benchmarks", label: "Benchmarks & Balance" },
  { id: "paradigms", label: "GenAI Paradigms" },
];

export function TopNav({
  activeTab,
  onSelectTab,
  batchCount,
  onExportDataset,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between gap-8">
      <a
        href="#studio"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab("studio");
        }}
        className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
      >
        DamageAugment AI
      </a>

      <nav className="hidden md:flex items-center gap-6" aria-label="Primary workbench views">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isActive
                  ? "text-blue-700"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
              {item.id === "batch_qa" && batchCount > 0 ? (
                <span className="ml-1.5 font-mono text-xs text-slate-500 tabular-nums">
                  ({batchCount})
                </span>
              ) : null}
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-700"
                />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onExportDataset}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Export Dataset{batchCount > 0 ? ` · ${batchCount}` : ""}
        </button>
      </div>
    </header>
  );
}
