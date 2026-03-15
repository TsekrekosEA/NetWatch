const SEVERITY_OPTIONS = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

interface AlertToolbarProps {
  severityFilter: string;
  onSeverityChange: (severity: string) => void;
  ipFilter: string;
  onIpChange: (ip: string) => void;
  onExportCsv: () => void;
  totalCount: number;
  filteredCount: number;
}

export function AlertToolbar({
  severityFilter,
  onSeverityChange,
  ipFilter,
  onIpChange,
  onExportCsv,
  totalCount,
  filteredCount,
}: AlertToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 bg-surface-card px-4 py-2">
      <h2 className="text-sm font-medium text-gray-300">
        Alert Feed
        <span className="ml-2 text-xs text-gray-500">
          {filteredCount === totalCount
            ? `(${totalCount})`
            : `(${filteredCount} / ${totalCount})`}
        </span>
      </h2>

      <div className="ml-auto flex items-center gap-2">
        {/* Severity filter */}
        <div className="flex gap-0.5 rounded bg-surface p-0.5">
          {SEVERITY_OPTIONS.map((sev) => (
            <button
              key={sev}
              onClick={() => onSeverityChange(sev)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                severityFilter === sev
                  ? sev === "ALL"
                    ? "bg-gray-600 text-white"
                    : sev === "LOW"
                    ? "bg-gray-600 text-gray-200"
                    : sev === "MEDIUM"
                    ? "bg-amber-600 text-amber-100"
                    : sev === "HIGH"
                    ? "bg-orange-600 text-orange-100"
                    : "bg-red-600 text-red-100"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* IP search */}
        <input
          type="text"
          placeholder="Filter IP…"
          value={ipFilter}
          onChange={(e) => onIpChange(e.target.value)}
          className="w-28 rounded border border-gray-700 bg-surface px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-blue-600"
        />

        {/* CSV export */}
        <button
          onClick={onExportCsv}
          className="rounded border border-gray-700 bg-surface px-2 py-0.5 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200"
          title="Export alerts to CSV"
        >
          Export
        </button>
      </div>
    </div>
  );
}
