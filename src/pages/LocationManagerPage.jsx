import { useMemo, useState } from 'react';
import { Building2, Plus, X, Pencil, Archive, Trash2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useGetLocationTreeQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
} from '../store/api/locationApi';

// State → District → City → { Zone → Ward, ULB }. Both Zone and ULB hang off
// City, so this is a branch, not a straight line — `parentLevel` (not column
// position) is what drives the drill-down.
const LEVELS = [
  { key: 'states', label: 'State', plural: 'States', parentLevel: null, parentKey: null, nameField: 'name', codeField: 'code', codeLabel: 'Code' },
  { key: 'districts', label: 'District', plural: 'Districts', parentLevel: 'states', parentKey: 'state_id', nameField: 'name', codeField: 'code', codeLabel: 'Code' },
  { key: 'cities', label: 'City', plural: 'Cities', parentLevel: 'districts', parentKey: 'district_id', nameField: 'name', codeField: 'code', codeLabel: 'Code' },
  { key: 'zones', label: 'Zone', plural: 'Zones', parentLevel: 'cities', parentKey: 'city_id', nameField: 'name', codeField: 'code', codeLabel: 'Code' },
  { key: 'wards', label: 'Ward', plural: 'Wards', parentLevel: 'zones', parentKey: 'zone_id', nameField: 'ward_name', codeField: 'ward_number', codeLabel: 'Ward No.' },
  { key: 'ulbs', label: 'ULB', plural: 'ULBs', parentLevel: 'cities', parentKey: 'city_id', nameField: 'name', codeField: 'code', codeLabel: 'Code' },
];

// A level's transitive descendants, for clearing selections when a parent
// changes (index position no longer implies ancestry once the tree branches).
const descendantKeys = (levelKey) => {
  const out = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const l of LEVELS) {
      if (l.parentLevel && (l.parentLevel === levelKey || out.has(l.parentLevel)) && !out.has(l.key)) {
        out.add(l.key);
        grew = true;
      }
    }
  }
  return out;
};

function LocationModal({ level, parentId, existing, onClose }) {
  const isEdit = Boolean(existing);
  const [name, setName] = useState(existing?.[level.nameField] || '');
  const [code, setCode] = useState(existing?.[level.codeField] || '');
  const [createLocation, { isLoading: creating }] = useCreateLocationMutation();
  const [updateLocation, { isLoading: updating }] = useUpdateLocationMutation();
  const busy = creating || updating;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(`${level.label} name is required`);

    const body = { [level.nameField]: name.trim(), [level.codeField]: code.trim() || null };
    if (level.parentKey && !isEdit) body[level.parentKey] = parentId;

    try {
      if (isEdit) {
        await updateLocation({ level: level.key, id: existing.id, ...body }).unwrap();
        toast.success(`${level.label} updated`);
      } else {
        await createLocation({ level: level.key, ...body }).unwrap();
        toast.success(`${level.label} created`);
      }
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || `Failed to save ${level.label.toLowerCase()}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? `Edit ${level.label}` : `New ${level.label}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {level.label} Name *
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={`e.g. ${level.label === 'Ward' ? 'Vikas Nagar' : level.label === 'Zone' ? 'Zone 2' : level.label}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{level.codeLabel}</label>
            <input value={code} onChange={(e) => setCode(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={busy}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold">
              {busy ? 'Saving…' : isEdit ? 'Save' : `Create ${level.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LevelColumn({ level, rows, selectedId, onSelect, parentId, showArchived }) {
  const [modal, setModal] = useState(null); // { existing? }
  const [deleteLocation] = useDeleteLocationMutation();

  const canAdd = level.parentKey === null || Boolean(parentId);

  const archive = async (row) => {
    const label = row[level.nameField];
    if (!window.confirm(`Archive "${label}"? It will be hidden but not deleted.`)) return;
    try {
      await deleteLocation({ level: level.key, id: row.id }).unwrap();
      toast.success(`${level.label} archived`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to archive');
    }
  };

  const hardDelete = async (row) => {
    const label = row[level.nameField];
    if (!window.confirm(`Permanently delete "${label}"? This cannot be undone.`)) return;
    try {
      await deleteLocation({ level: level.key, id: row.id, hard: true }).unwrap();
      toast.success(`${level.label} deleted`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete');
    }
  };

  const visible = showArchived ? rows : rows.filter((r) => r.is_active !== false);

  return (
    <div className="flex-1 min-w-[220px] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">
          {level.plural} <span className="text-gray-400 dark:text-gray-500 font-normal">({visible.length})</span>
        </h3>
        <button
          onClick={() => setModal({})}
          disabled={!canAdd}
          title={canAdd ? `Add ${level.label}` : `Select a ${LEVELS.find((l) => l.key === level.parentLevel)?.label} first`}
          className="p-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:hover:bg-transparent"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto max-h-[460px]">
        {!canAdd && (
          <p className="px-4 py-6 text-xs text-gray-400 dark:text-gray-500">
            Select a {LEVELS.find((l) => l.key === level.parentLevel)?.label.toLowerCase()} to see its {level.plural.toLowerCase()}.
          </p>
        )}
        {canAdd && visible.length === 0 && (
          <p className="px-4 py-6 text-xs text-gray-400 dark:text-gray-500">
            No {level.plural.toLowerCase()} yet.
          </p>
        )}
        {canAdd && visible.map((row) => {
          const active = row.is_active !== false;
          return (
            <div
              key={row.id}
              onClick={() => onSelect(row.id)}
              className={`px-4 py-2.5 cursor-pointer group flex items-center gap-2 ${
                selectedId === row.id
                  ? 'bg-blue-50 dark:bg-blue-950/50'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm truncate ${active ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 line-through'}`}>
                  {row[level.nameField]}
                </p>
                {row[level.codeField] && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{row[level.codeField]}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={(e) => { e.stopPropagation(); setModal({ existing: row }); }}
                  title="Edit"
                  className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {active ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); archive(row); }}
                    title="Archive"
                    className="p-1 rounded text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); hardDelete(row); }}
                    title="Delete permanently"
                    className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {selectedId === row.id && <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {modal && (
        <LocationModal
          level={level}
          parentId={parentId}
          existing={modal.existing}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default function LocationManagerPage() {
  const { data, isLoading, isError } = useGetLocationTreeQuery();
  const [selected, setSelected] = useState({});
  const [showArchived, setShowArchived] = useState(false);

  const tree = data?.data || { states: [], districts: [], cities: [], zones: [], ulbs: [], wards: [] };

  // Each column shows only the children of its parent level's current selection.
  const rowsFor = useMemo(() => {
    const out = {};
    for (const lvl of LEVELS) {
      const all = tree[lvl.key] || [];
      out[lvl.key] = lvl.parentKey
        ? all.filter((r) => String(r[lvl.parentKey]) === String(selected[lvl.parentLevel]))
        : all;
    }
    return out;
  }, [tree, selected]);

  // Selecting a level clears its transitive descendants (a sibling branch like
  // ULB must survive picking a Zone).
  const select = (levelKey, id) => {
    const kill = descendantKeys(levelKey);
    const next = { ...selected, [levelKey]: id };
    kill.forEach((k) => delete next[k]);
    setSelected(next);
  };

  const parentIdFor = (lvl) => (lvl.parentLevel ? selected[lvl.parentLevel] : null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Locations</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                State → District → City → Zone → Ward · plus ULBs under each City
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Show archived
          </label>
        </div>
      </header>

      <div className="p-6">
        {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading hierarchy…</p>}
        {isError && (
          <p className="text-red-600 dark:text-red-400">Failed to load locations. Is the backend running?</p>
        )}

        {!isLoading && !isError && (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Click a row to drill into the next level. Hover a row for edit / archive actions.
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {LEVELS.map((lvl) => (
                <LevelColumn
                  key={lvl.key}
                  level={lvl}
                  rows={rowsFor[lvl.key]}
                  selectedId={selected[lvl.key]}
                  onSelect={(id) => select(lvl.key, id)}
                  parentId={parentIdFor(lvl)}
                  showArchived={showArchived}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
