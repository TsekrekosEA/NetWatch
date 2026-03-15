interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer animate-skeleton rounded ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg bg-surface px-4 py-2">
      <Skeleton className="mb-2 h-3 w-16" />
      <Skeleton className="mb-1 h-6 w-24" />
      <Skeleton className="h-2 w-20" />
    </div>
  );
}

export function SkeletonChart({ height = "h-[200px]" }: { height?: string }) {
  return (
    <div
      className={`flex flex-col rounded-lg border border-gray-800 bg-surface-card p-4 ${height}`}
    >
      <Skeleton className="mb-3 h-4 w-40" />
      <div className="flex flex-1 items-end gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${20 + ((i * 37) % 60)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
