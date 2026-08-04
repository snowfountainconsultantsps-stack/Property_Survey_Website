import { useState } from 'react';
import { Plus, X, Trash2, ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUpdateLayerMutation } from '../store/api/assetApi';

// Must mirror FIELD_TYPES in the backend's assetController.
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Choice list' },
  { value: 'date', label: 'Date' },
];

// Surveyor answers are stored under `key`, and reports filter on it — so a key
// that changes orphans every answer already collected under the old one.
const toKey = (label) =>
  String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, 'f$1');

function FieldRow({ field, index, total, onChange, onMove, onRemove, isNew }) {
  const set = (patch) => onChange({ ...field, ...patch });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/40">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 pt-1">
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              Question
            </label>
            <input
              value={field.label || ''}
              onChange={(e) => {
                const label = e.target.value;
                // Only auto-derive the key for a brand-new field; changing it
                // later would strand answers already recorded against it.
                set(isNew ? { label, key: toKey(label) } : { label });
              }}
              placeholder="e.g. Road Width"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              Answer type
            </label>
            <select
              value={field.type || 'text'}
              onChange={(e) => set({ type: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {field.type === 'select' && (
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                Choices (comma separated)
              </label>
              <input
                value={(field.options || []).join(', ')}
                onChange={(e) =>
                  set({ options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })
                }
                placeholder="Good, Fair, Poor"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          {field.type === 'number' && (
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                Unit (optional)
              </label>
              <input
                value={field.unit || ''}
                onChange={(e) => set({ unit: e.target.value })}
                placeholder="m, mm, kVA"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          <div className="flex items-end gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={Boolean(field.required)}
                onChange={(e) => set({ required: e.target.checked })}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Required
            </label>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate" title={field.key}>
              {field.key}
            </span>
          </div>
        </div>

        <button type="button" onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 pt-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function QuestionSchemaEditor({ layer, onClose }) {
  const [fields, setFields] = useState(() =>
    (layer.attribute_schema || []).map((f) => ({ ...f }))
  );
  // Keys already in use hold collected answers; new ones are still free to rename.
  const [existingKeys] = useState(
    () => new Set((layer.attribute_schema || []).map((f) => f.key))
  );
  const [updateLayer, { isLoading }] = useUpdateLayerMutation();

  const update = (i, next) => setFields((fs) => fs.map((f, idx) => (idx === i ? next : f)));
  const remove = (i) => setFields((fs) => fs.filter((_, idx) => idx !== i));
  const move = (i, dir) =>
    setFields((fs) => {
      const j = i + dir;
      if (j < 0 || j >= fs.length) return fs;
      const next = [...fs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = () =>
    setFields((fs) => [...fs, { key: '', label: '', type: 'text', required: false }]);

  const save = async () => {
    // Mirror the server's rules so problems surface before the round trip.
    const seen = new Set();
    for (const [i, f] of fields.entries()) {
      const at = `Question ${i + 1}`;
      if (!f.label?.trim()) return toast.error(`${at}: enter the question text.`);
      if (!f.key || !/^[a-z][a-z0-9_]*$/.test(f.key)) {
        return toast.error(`${at}: invalid field key "${f.key || ''}".`);
      }
      if (seen.has(f.key)) return toast.error(`${at}: duplicate field key "${f.key}".`);
      seen.add(f.key);
      if (f.type === 'select' && !(f.options || []).length) {
        return toast.error(`${at}: add at least one choice.`);
      }
    }

    try {
      await updateLayer({ id: layer.id, attribute_schema: fields }).unwrap();
      toast.success('Questions saved');
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to save questions');
    }
  };

  const removedKeys = [...existingKeys].filter((k) => !fields.some((f) => f.key === k));

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Survey Questions</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {layer.name} · asked when a surveyor opens one of these assets
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3 overflow-y-auto">
          {fields.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
              No questions yet — surveyors will only record condition, notes and photos.
            </p>
          )}
          {fields.map((f, i) => (
            <FieldRow
              key={i}
              field={f}
              index={i}
              total={fields.length}
              isNew={!existingKeys.has(f.key)}
              onChange={(next) => update(i, next)}
              onMove={move}
              onRemove={remove}
            />
          ))}

          <button type="button" onClick={add}
            className="w-full border border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 flex items-center justify-center gap-1">
            <Plus className="w-4 h-4" /> Add question
          </button>

          {removedKeys.length > 0 && (
            <div className="flex gap-2 text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
              <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-300">
                Removing <span className="font-mono">{removedKeys.join(', ')}</span> stops the question
                being asked. Answers already collected stay in the database but will no longer appear
                in the form or in filters.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            Cancel
          </button>
          <button onClick={save} disabled={isLoading}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold">
            {isLoading ? 'Saving…' : 'Save Questions'}
          </button>
        </div>
      </div>
    </div>
  );
}
