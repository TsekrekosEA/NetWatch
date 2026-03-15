interface SeverityBadgeProps {
  severity: string;
}

const COLORS: Record<string, string> = {
  LOW: "bg-gray-600 text-gray-200",
  MEDIUM: "bg-amber-600 text-amber-100",
  HIGH: "bg-orange-600 text-orange-100",
  CRITICAL: "bg-red-600 text-red-100",
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const cls = COLORS[severity] ?? COLORS.LOW;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {severity}
    </span>
  );
}
