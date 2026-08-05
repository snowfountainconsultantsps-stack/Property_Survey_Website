import { useState } from 'react';
import {
  X, Upload, FileSearch, CheckCircle2, AlertTriangle, Plus, RefreshCw, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  usePreviewBoundaryImportMutation,
  useCommitBoundaryImportMutation,
} from '../store/api/boundaryApi';

// Builds a level of the hierarchy from a shapefile/GeoJSON instead of typing
// rows in by hand. Three stages, and nothing is written until the last one:
//
//   1 pick file  →  2 map the name/code column, review every row  →  3 commit
//
// The file is re-sent on commit rather than staged server-side, so an
// abandoned import leaves nothing behind to clean up.
export default function BoundaryImportModal({ level, levelLabel, parentId, parentLabel, onClose }) {
  const [file, setFile] = useState(null);
  const [fields, setFields] = useState([]);
  const [samples, setSamples] = useState({});
  const [nameField, setNameField] = useState('');
  const [codeField, setCodeField] = useState('');
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [excluded, setExcluded] = useState(() => new Set());

  const [preview, { isLoading: previewing }] = usePreviewBoundaryImportMutation();
  const [commit, { isLoading: committing }] = useCommitBoundaryImportMutation();

  const buildForm = (extra = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    if (parentId) fd.append('parent_id', parentId);
    Object.entries(extra).forEach(([k, v]) => v && fd.append(k, v));
    return fd;
  };

  // Stage 1 → read the file's attribute columns.
  const inspect = async (f) => {
    setFile(f);
    setRows(null); setSummary(null); setNameField(''); setCodeField('');
    try {
      const res = await preview({ level, formData: (() => {
        const fd = new FormData();
        fd.append('file', f);
        if (parentId) fd.append('parent_id', parentId);
        return fd;
      })() }).unwrap();
      setFields(res.data.fields || []);
      setSamples(res.data.sample_values || {});
      // A column literally called name/…_name is almost always the right one.
      const guess = (res.data.fields || []).find((k) => /name$/i.test(k)) || '';
      setNameField(guess);
    } catch (err) {
      toast.error(err?.data?.message || 'Could not read that file');
      setFile(null);
    }
  };

  // Stage 2 → show exactly what would be created/updated.
  const check = async () => {
    if (!nameField) return toast.error('Choose which column holds the name');
    try {
      const res = await preview({
        level,
        formData: buildForm({ name_field: nameField, code_field: codeField }),
      }).unwrap();
      setRows(res.data.rows || []);
      setSummary(res.data.summary || null);
      setExcluded(new Set());
    } catch (err) {
      toast.error(err?.data?.message || 'Preview failed');
    }
  };

  // Stage 3 → write.
  const doImport = async () => {
    const include = rows.filter((r) => !excluded.has(r.name)).map((r) => r.name);
    if (!include.length) return toast.error('Nothing selected to import');
    try {
      const res = await commit({
        level,
        formData: buildForm({
          name_field: nameField,
          code_field: codeField,
          include: JSON.stringify(include),
        }),
      }).unwrap();
      toast.success(res.message || 'Imported');
      onClose(true);
    } catch (err) {
      toast.error(err?.data?.message || 'Import failed');
    }
  };

  const toggle = (name) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const selectedCount = rows ? rows.length - excluded.size : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => onClose(false)}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Import {levelLabel} from shapefile
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {parentLabel ? `Under ${parentLabel} · ` : ''}Creates rows and their boundaries. Nothing is saved until you confirm.
            </p>
          </div>
          <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* ── Stage 1 ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              1. Shapefile (.zip) or GeoJSON
            </label>
            <input
              type="file"
              accept=".zip,.geojson,.json"
              onChange={(e) => e.target.files?.[0] && inspect(e.target.files[0])}
              className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-semibold hover:file:bg-blue-700"
            />
            {previewing && !rows && (
              <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading file…
              </p>
            )}
          </div>

          {/* ── Stage 2 ── */}
          {fields.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                2. Which column holds the {levelLabel.toLowerCase()} name?
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Name column *</p>
                  <select
                    value={nameField}
                    onChange={(e) => { setNameField(e.target.value); setRows(null); }}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {fields.map((f) => (
                      <option key={f} value={f}>
                        {f}{samples[f] != null ? `  (e.g. ${String(samples[f]).slice(0, 20)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Code column (optional)</p>
                  <select
                    value={codeField}
                    onChange={(e) => { setCodeField(e.target.value); setRows(null); }}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={check}
                disabled={!nameField || previewing}
                className="mt-3 flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
                Preview what will be created
              </button>
            </div>
          )}

          {/* ── Stage 3 ── */}
          {rows && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  3. Verify — {selectedCount} of {rows.length} selected
                </label>
                {summary && (
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 font-semibold">
                      {summary.create} new
                    </span>
                    {summary.update > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-semibold">
                        {summary.update} will be updated
                      </span>
                    )}
                  </div>
                )}
              </div>

              {summary?.update > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  Rows marked “update” already exist — their boundary will be overwritten.
                </p>
              )}

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((r) => (
                  <label
                    key={r.name}
                    className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <input
                      type="checkbox"
                      checked={!excluded.has(r.name)}
                      onChange={() => toggle(r.name)}
                      className="rounded border-gray-300"
                    />
                    <span className="flex-1 text-gray-800 dark:text-gray-200">{r.name}</span>
                    {r.code && <span className="text-xs font-mono text-gray-400">{r.code}</span>}
                    {r.parts > 1 && (
                      <span className="text-[10px] text-gray-400" title="Merged from several polygons">
                        {r.parts} parts
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        r.action === 'create'
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {r.action}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => onClose(false)} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={!rows || committing || selectedCount === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold"
          >
            {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Import {selectedCount || ''} {levelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
