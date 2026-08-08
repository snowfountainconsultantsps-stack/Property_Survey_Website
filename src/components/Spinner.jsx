import { Loader2 } from 'lucide-react';

/**
 * Inline spinner. Pair it with a label wherever the wait needs explaining —
 * a bare spinner next to a number tells the user something is happening but
 * not that the number they are reading is about to change.
 */
export default function Spinner({ className = 'w-4 h-4', label = null, srLabel = 'Loading' }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 align-middle"
      role="status"
      aria-live="polite"
    >
      <Loader2 className={`${className} animate-spin`} aria-hidden="true" />
      {label ? <span className="text-xs">{label}</span> : <span className="sr-only">{srLabel}</span>}
    </span>
  );
}

/**
 * Covers a panel while it loads. Requires a `relative` parent.
 *
 * `subtle` is for a panel that already has content on screen — a re-fetch
 * after a filter change, say. A full veil there would hide the very thing the
 * user is waiting to see change, so it shows a corner chip instead and leaves
 * the stale content readable and interactive underneath.
 */
export function LoadingOverlay({ label = 'Loading…', subtle = false }) {
  if (subtle) {
    return (
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-gray-800/95 border border-gray-200 dark:border-gray-700 px-2.5 py-1 shadow-sm pointer-events-none">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-2 bg-white/75 dark:bg-gray-900/75"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" aria-hidden="true" />
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    </div>
  );
}

/** Placeholder bar for a value that hasn't arrived yet. */
export function Skeleton({ className = 'h-4 w-16' }) {
  return <span className={`inline-block rounded bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`} />;
}
