import { useMemo, useState } from 'react';
import { Filter, Plus, X, Search, Download, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetCategoriesQuery, useSearchFeaturesMutation } from '../store/api/assetApi';

// Operators the backend whitelists, narrowed per field type.
const NUMERIC_OPS = [
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'at most' },
  { value: 'eq', label: 'equals' },
  { value: 'gte', label: 'at least' },
  { value: 'gt', label: 'greater than' },
  { value: 'ne', label: 'not equal to' },
];
const TEXT_OPS = [
  { value: 'eq', label: 'is' },
  { value: 'ne', label: 'is not' },
];

const opsFor = (type) => (type === 'number' ? NUMERIC_OPS : TEXT_OPS);

export default function AssetReportPage() {
  const { data: catRes } = useGetCategoriesQuery();
  const categories = catRes?.data || [];

  const [layerId, setLayerId] = useState('');
  const [filters, setFilters] = useState([]);
  const [rows, setRows] = useState(null);
  const [searchFeatures, { isLoading }] = useSearchFeaturesMutation();

  const layers = useMemo(
    () => categories.flatMap((c) => (c.layers || []).map((l) => ({ ...l, categoryName: c.name }))),
    [categories]
  );
  const layer = layers.find((l) => String(l.id) === String(layerId));
  const schema = layer?.attribute_schema || [];

  const changeLayer = (id) => {
    setLayerId(id);
    setFilters([]); // fields differ per layer, so old conditions can't carry over
    setRows(null);
  };

  const addFilter = () => {
    const first = schema[0];
    if (!first) return toast.error('This asset type has no questions to filter on yet.');
    setFilters((f) => [...f, { key: first.key, op: opsFor(first.type)[0].value, value: '' }]);
  };

  const setFilter = (i, patch) =>
    setFilters((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  const run = async () => {
    if (!layer) return toast.error('Choose an asset type');
    const clean = filters.filter((f) => String(f.value).trim() !== '');
    try {
      const res = await searchFeatures({ layer_id: Number(layerId), filters: clean }).unwrap();
      setRows(res.features || []);
      toast.success(`${res.count} matching asset${res.count === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Search failed');
    }
  };

  const exportCsv = () => {
    if (!rows?.length) return;
    const cols = ['id', 'feature_code', ...schema.map((f) => f.key)];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      cols.join(','),
      ...rows.map((r) => cols.map((c) => esc(r.properties?.[c])).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layer.code}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center gap-3">
          <Filter className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Asset Reports</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Find assets by what surveyors recorded — e.g. roads narrower than 10 m
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset type</label>
            <select value={layerId} onChange={(e) => changeLayer(e.target.value)}
              className="w-full max-w-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Select an asset type…</option>
              {categories.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {(c.layers || []).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {layer && (
            <>
              <div className="space-y-2">
                {filters.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    No conditions — running now returns every {layer.name.toLowerCase()}.
                  </p>
                )}
                {filters.map((f, i) => {
                  const field = schema.find((s) => s.key === f.key);
                  const ops = opsFor(field?.type);
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <select value={f.key}
                        onChange={(e) => {
                          const next = schema.find((s) => s.key === e.target.value);
                          setFilter(i, { key: e.target.value, op: opsFor(next?.type)[0].value, value: '' });
                        }}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
                        {schema.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>

                      <select value={f.op} onChange={(e) => setFilter(i, { op: e.target.value })}
                        className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
                        {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>

                      {field?.type === 'select' ? (
                        <select value={f.value} onChange={(e) => setFilter(i, { value: e.target.value })}
                          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
                          <option value="">Choose…</option>
                          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : field?.type === 'boolean' ? (
                        <select value={f.value} onChange={(e) => setFilter(i, { value: e.target.value })}
                          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
                          <option value="">Choose…</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          value={f.value}
                          onChange={(e) => setFilter(i, { value: e.target.value })}
                          type={field?.type === 'number' ? 'number' : 'text'}
                          placeholder={field?.unit ? `value (${field.unit})` : 'value'}
                          className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm w-40"
                        />
                      )}

                      <button onClick={() => setFilters((fs) => fs.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={addFilter}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  <Plus className="w-4 h-4" /> Add condition
                </button>
                <div className="flex-1" />
                <button onClick={run} disabled={isLoading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold px-5 py-2 rounded-lg">
                  <Search className="w-4 h-4" /> {isLoading ? 'Searching…' : 'Run report'}
                </button>
              </div>
            </>
          )}
        </div>

        {rows && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {rows.length} result{rows.length === 1 ? '' : 's'}
              </h3>
              {rows.length > 0 && (
                <button onClick={exportCsv}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 dark:text-gray-500 text-center">
                Nothing matched. Assets only carry these values once a surveyor has recorded them.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-5 py-2 font-medium">Code</th>
                      {schema.map((f) => (
                        <th key={f.key} className="text-left px-3 py-2 font-medium">
                          {f.label}{f.unit ? ` (${f.unit})` : ''}
                        </th>
                      ))}
                      <th className="text-left px-3 py-2 font-medium">Surveyed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rows.map((r) => (
                      <tr key={r.properties.id}>
                        <td className="px-5 py-2 text-gray-800 dark:text-gray-200 font-mono text-xs">
                          {r.properties.feature_code || r.properties.id}
                        </td>
                        {schema.map((f) => (
                          <td key={f.key} className="px-3 py-2 text-gray-700 dark:text-gray-300">
                            {r.properties[f.key] === null || r.properties[f.key] === undefined
                              ? '—'
                              : String(r.properties[f.key])}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            r.properties.survey_state === 'DONE'
                              ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                            {r.properties.survey_state === 'DONE' ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!layer && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">Pick an asset type to start</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Conditions are built from that type&apos;s survey questions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
