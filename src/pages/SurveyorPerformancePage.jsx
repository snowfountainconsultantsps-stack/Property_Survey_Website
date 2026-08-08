import { Gauge, MapPin, AlertTriangle, User } from 'lucide-react';
import { useGetPerformanceQuery } from '../store/api/assignmentApi';

function Bar({ percent }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          percent >= 75 ? 'bg-green-500' : percent >= 40 ? 'bg-amber-500' : 'bg-red-500'
        }`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export default function SurveyorPerformancePage() {
  const { data, isLoading, isError } = useGetPerformanceQuery();
  const rows = data?.data || [];

  const unallocated = rows.filter((r) => r.area_count === 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center gap-3">
          <Gauge className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Surveyor Performance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Allocated areas and progress against them
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading…</p>}
        {isError && (
          <p className="text-red-600 dark:text-red-400">Failed to load. Is the backend running?</p>
        )}

        {unallocated.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>{unallocated.length}</strong> surveyor(s) have no area allocated —
              they see no assets in the app: {unallocated.map((r) => r.user.full_name).join(', ')}
            </p>
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <User className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">No surveyors yet</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.user.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-gray-100 truncate">
                    {r.user.full_name}
                    {!r.user.is_active && (
                      <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500">
                        INACTIVE
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{r.user.phone}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                    {r.progress.percent}%
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">of allocated area</p>
                </div>
              </div>

              <Bar percent={r.progress.percent} />

              <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                {[
                  ['In scope', r.progress.total, 'text-gray-900 dark:text-gray-100'],
                  ['Surveyed', r.progress.surveyed, 'text-green-600 dark:text-green-400'],
                  ['In progress', r.progress.in_progress, 'text-amber-600 dark:text-amber-400'],
                  ['Pending', r.progress.pending, 'text-gray-500 dark:text-gray-400'],
                ].map(([label, value, cls]) => (
                  <div key={label}>
                    <p className={`text-lg font-bold ${cls}`}>{value}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                  Allocated areas ({r.area_count})
                </p>
                {r.areas.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">None — sees nothing in the app</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {r.areas.map((a) => (
                      <span
                        key={a.id}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                      >
                        <MapPin className="w-3 h-3" /> {a.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
                Personally submitted: {r.own.property_surveys} property survey(s)
                {r.own.completed ? `, ${r.own.completed} completed` : ''}
                {r.own.asset_surveys ? ` · ${r.own.asset_surveys} asset survey(s)` : ''}
                {r.own.last_survey_at
                  ? ` · last ${new Date(r.own.last_survey_at).toLocaleDateString()}`
                  : ' · no submissions yet'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
