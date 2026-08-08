import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Map as MapIcon, Upload, UploadCloud, X, CheckCircle2, XCircle, Lock, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import BoundaryMap from '../components/BoundaryMap';
import BoundaryImportModal from '../components/BoundaryImportModal';
import { useGetLocationTreeQuery } from '../store/api/locationApi';
import {
  useGetBoundariesQuery,
  useUploadSingleBoundaryMutation,
  // Bulk import moved to BoundaryImportModal (preview → verify → commit).
} from '../store/api/boundaryApi';

// Mirrors the current hierarchy: State → District → {City, ULB} →
// {Zone, Ward} → Locality.
const LEVELS = [
  { value: 'STATE', label: 'State' },
  { value: 'DISTRICT', label: 'District' },
  { value: 'CITY', label: 'City' },
  { value: 'ULB', label: 'ULB' },
  { value: 'ZONE', label: 'Zone' },
  { value: 'WARD', label: 'Ward' },
  { value: 'LOCALITY', label: 'Locality' },
];

const displayName = (row) => row.name || row.ward_name || '—';
const displayCode = (row) => row.code || row.ward_number || null;

// Levels that read better grouped under their immediate parent than as one
// long flat list: wards belong to a zone, localities to a ward. `key` is the
// FK on the child, `from` the tree collection holding the parents.
const GROUP_BY = {
  WARD: { key: 'zone_id', from: 'zones', label: 'Zone', labelOf: (p) => p.name },
  LOCALITY: { key: 'ward_id', from: 'wards', label: 'Ward', labelOf: (p) => p.ward_name },
};

// ─── Per-row: upload one boundary for one entity ────────────────
function UploadSingleModal({ level, entity, onClose }) {
  const [file, setFile] = useState(null);
  const [uploadSingle, { isLoading }] = useUploadSingleBoundaryMutation();

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Choose a .zip shapefile or .geojson file');
    const fd = new FormData();
    fd.append('file', file);
    const t = toast.loading('Uploading boundary…');
    try {
      const res = await uploadSingle({ level, id: entity.id, formData: fd }).unwrap();
      toast.dismiss(t);
      toast.success(res.message || 'Boundary saved');
      onClose();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err?.data?.message || 'Upload failed');
    }
  };

  // Portalled for the same reason as BoundaryImportModal: this dialog is
  // mounted from the list panel, which precedes the map in the DOM, so at an
  // equal z-index Leaflet's controls rendered on top of it.
  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Upload Boundary</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {displayName(entity)}{displayCode(entity) ? ` (${displayCode(entity)})` : ''}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File (.zip shapefile or .geojson)</label>
            <input type="file" accept=".zip,.geojson,.json"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 dark:file:bg-purple-950 file:text-purple-700 dark:file:text-purple-400 file:font-semibold hover:file:bg-purple-100 dark:hover:file:bg-purple-900" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={isLoading}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-purple-900 text-white font-semibold">
              {isLoading ? 'Uploading…' : 'Save Boundary'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── One row in the entity list ─────────────────────────────────
function EntityRow({ row, hasBoundary, onUpload, indent = false }) {
  return (
    <div className={`${indent ? 'pl-9 pr-5' : 'px-5'} py-2.5 flex items-center justify-between gap-3`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{displayName(row)}</p>
        {displayCode(row) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{displayCode(row)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
          hasBoundary
            ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        }`}>
          {hasBoundary ? <Lock className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {hasBoundary ? 'Published' : 'No boundary'}
        </span>
        {/* A published boundary is final — no upload offered, and the endpoint
            rejects an overwrite regardless. */}
        {!hasBoundary && (
          <button onClick={onUpload}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900">
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Grouped list: wards under their zone, localities under their ward ──────
// A flat list of 100+ wards is unusable; grouping mirrors the hierarchy and
// keeps each parent collapsible so several can be open at once.
function GroupedEntityList({ group, parents, entities, boundaryIds, onUpload }) {
  const [open, setOpen] = useState(() => new Set());

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const buckets = useMemo(() => {
    const byParent = new Map();
    const orphans = [];
    for (const e of entities) {
      const pid = e[group.key];
      if (!pid) { orphans.push(e); continue; }
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(e);
    }
    const list = parents
      .filter((p) => byParent.has(p.id))
      .map((p) => ({ id: p.id, label: group.labelOf(p), rows: byParent.get(p.id) }));
    // Children whose parent isn't in the current scope still need showing.
    if (orphans.length) list.push({ id: '__none__', label: `No ${group.label.toLowerCase()}`, rows: orphans });
    return list;
  }, [entities, parents, group]);

  const allOpen = buckets.length > 0 && buckets.every((b) => open.has(b.id));

  return (
    <>
      <div className="px-5 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          Grouped by {group.label.toLowerCase()} — click one to see its {group.label === 'Zone' ? 'wards' : 'localities'}
        </span>
        <button
          onClick={() => setOpen(allOpen ? new Set() : new Set(buckets.map((b) => b.id)))}
          className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {buckets.map((b) => {
        const isOpen = open.has(b.id);
        const published = b.rows.filter((r) => boundaryIds.has(r.id)).length;
        return (
          <div key={b.id}>
            <button
              onClick={() => toggle(b.id)}
              className="w-full px-5 py-2.5 flex items-center gap-2 text-left bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-700/40 transition"
            >
              <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1 truncate">{b.label}</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                {published}/{b.rows.length} published
              </span>
            </button>
            {isOpen && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {b.rows.map((row) => (
                  <EntityRow
                    key={row.id}
                    row={row}
                    indent
                    hasBoundary={boundaryIds.has(row.id)}
                    onUpload={() => onUpload(row)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Bulk: import a shapefile, creating rows that don't exist yet ──────────
// Replaces the old "type the attribute name and hope it matches" panel, which
// could only attach boundaries to rows already in the database — useless when
// building the hierarchy from scratch. The importer reads the file's columns,
// shows exactly what will be created or updated, and only then writes.
function BulkUploadPanel({ level, parentId, parentLabel, onPublished }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <UploadCloud className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        Import {level.toLowerCase()}s from shapefile
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Upload one file containing <strong>all</strong> {level.toLowerCase()} boundaries — each one is
        matched to the parent it geographically falls inside, so you don&apos;t need to import them
        parent by parent. The preview shows every match before anything is saved.
        {parentLabel ? ` A selected parent (${parentLabel}) is only used where no match is found.` : ''}
      </p>

      <button
        onClick={() => setOpen(true)}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg transition"
      >
        Choose file &amp; preview
      </button>

      {open && (
        <BoundaryImportModal
          level={level}
          levelLabel={`${level.charAt(0)}${level.slice(1).toLowerCase()}s`}
          parentId={parentId}
          parentLabel={parentLabel}
          onClose={(published) => {
            setOpen(false);
            // The row list comes from locationApi and the badges from
            // boundaryApi — separate slices, so neither refreshes the other.
            if (published) onPublished?.();
          }}
        />
      )}
    </div>
  );
}

export default function LocationBoundariesPage() {
  const [level, setLevel] = useState('STATE');
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [ulbId, setUlbId] = useState('');
  const [wardId, setWardId] = useState('');
  const [uploadingEntity, setUploadingEntity] = useState(null);

  // One call for the whole hierarchy — the per-level endpoints assumed the old
  // City → Zone → Ward chain, which no longer holds now that the ULB is the
  // operational parent.
  const { data: treeRes, refetch: refetchTree } = useGetLocationTreeQuery();
  const tree = treeRes?.data || {};

  const states = tree.states || [];
  const districts = useMemo(
    () => (tree.districts || []).filter((d) => !stateId || String(d.state_id) === String(stateId)),
    [tree.districts, stateId]
  );
  const cities = useMemo(
    () => (tree.cities || []).filter((c) => !districtId || String(c.district_id) === String(districtId)),
    [tree.cities, districtId]
  );
  const ulbs = useMemo(
    () => (tree.ulbs || []).filter((u) => !districtId || String(u.district_id) === String(districtId)),
    [tree.ulbs, districtId]
  );
  const zones = useMemo(
    () => (tree.zones || []).filter((z) => !ulbId || String(z.ulb_id) === String(ulbId)),
    [tree.zones, ulbId]
  );
  const wards = useMemo(
    () => (tree.wards || []).filter((w) => !ulbId || String(w.ulb_id) === String(ulbId)),
    [tree.wards, ulbId]
  );
  // All localities in the chosen ULB (across its wards) so they can be grouped
  // by ward. Picking a ward narrows further but isn't required.
  const localities = useMemo(() => {
    const wardIds = new Set(wards.map((w) => String(w.id)));
    return (tree.localities || []).filter((l) => {
      if (wardId) return String(l.ward_id) === String(wardId);
      return !ulbId || wardIds.has(String(l.ward_id));
    });
  }, [tree.localities, wards, wardId, ulbId]);

  const changeLevel = (v) => setLevel(v);
  const changeState = (v) => { setStateId(v); setDistrictId(''); setUlbId(''); setWardId(''); };
  const changeDistrict = (v) => { setDistrictId(v); setUlbId(''); setWardId(''); };
  const changeUlb = (v) => { setUlbId(v); setWardId(''); };

  // State → District → {City, ULB} → {Zone, Ward} → Locality
  const parentId =
    level === 'DISTRICT' ? stateId :
    level === 'CITY' ? districtId :
    level === 'ULB' ? districtId :
    level === 'ZONE' ? ulbId :
    level === 'WARD' ? ulbId :
    // Optional for localities — leaving it blank lists every locality in the
    // ULB so they can be grouped by ward.
    level === 'LOCALITY' ? wardId : null;

  const parentReady =
    level === 'STATE' ? true :
    level === 'LOCALITY' ? Boolean(ulbId) :
    Boolean(parentId);

  const entities =
    level === 'STATE' ? states :
    level === 'DISTRICT' ? districts :
    level === 'CITY' ? cities :
    level === 'ULB' ? ulbs :
    level === 'ZONE' ? zones :
    level === 'WARD' ? wards : localities;

  const { data: boundariesRes, refetch: refetchBoundaries } = useGetBoundariesQuery(
    { level, parentId: parentId || undefined },
    { skip: !parentReady }
  );
  const boundaryIds = useMemo(
    () => new Set((boundariesRes?.features || []).map((f) => f.properties.id)),
    [boundariesRes]
  );

  const parentLabel =
    level === 'DISTRICT' ? states.find((s) => String(s.id) === String(stateId))?.name :
    (level === 'CITY' || level === 'ULB') ? districts.find((d) => String(d.id) === String(districtId))?.name :
    (level === 'ZONE' || level === 'WARD') ? ulbs.find((u) => String(u.id) === String(ulbId))?.name :
    level === 'LOCALITY' ? wards.find((w) => String(w.id) === String(wardId))?.ward_name : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <MapIcon className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Location Boundaries</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload and manage State / District / City / Ward boundary polygons.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Level tabs */}
        <div className="flex gap-2">
          {LEVELS.map((l) => (
            <button key={l.value} onClick={() => changeLevel(l.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                level === l.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Scope selectors */}
        {level !== 'STATE' && (
          <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">State</label>
              <select value={stateId} onChange={(e) => changeState(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none">
                <option value="">Select state…</option>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {level !== 'DISTRICT' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">District</label>
                <select value={districtId} onChange={(e) => changeDistrict(e.target.value)} disabled={!stateId}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50">
                  <option value="">Select district…</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {/* Zones, wards and localities all sit under the ULB now. */}
            {(level === 'ZONE' || level === 'WARD' || level === 'LOCALITY') && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">ULB</label>
                <select value={ulbId} onChange={(e) => changeUlb(e.target.value)} disabled={!districtId}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50">
                  <option value="">Select ULB…</option>
                  {ulbs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            {level === 'LOCALITY' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Ward <span className="text-gray-400">(optional)</span>
                </label>
                <select value={wardId} onChange={(e) => setWardId(e.target.value)} disabled={!ulbId}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50">
                  <option value="">All wards</option>
                  {wards.map((w) => <option key={w.id} value={w.id}>{w.ward_name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: bulk upload + entity list */}
          <div className="space-y-6">
            <BulkUploadPanel
              level={level}
              parentId={parentId}
              parentLabel={parentLabel}
              onPublished={() => { refetchTree(); refetchBoundaries(); }}
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">
                  {LEVELS.find((l) => l.value === level)?.label}s ({entities.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[420px] overflow-y-auto">
                {!parentReady && (
                  <p className="px-5 py-6 text-sm text-gray-400 dark:text-gray-500">Select a scope above to see the list.</p>
                )}
                {parentReady && entities.length === 0 && (
                  <p className="px-5 py-6 text-sm text-gray-400 dark:text-gray-500">Nothing here yet.</p>
                )}
                {parentReady && entities.length > 0 && (
                  GROUP_BY[level] ? (
                    <GroupedEntityList
                      group={GROUP_BY[level]}
                      parents={GROUP_BY[level].from === 'zones' ? zones : wards}
                      entities={entities}
                      boundaryIds={boundaryIds}
                      onUpload={setUploadingEntity}
                    />
                  ) : (
                    entities.map((row) => (
                      <EntityRow
                        key={row.id}
                        row={row}
                        hasBoundary={boundaryIds.has(row.id)}
                        onUpload={() => setUploadingEntity(row)}
                      />
                    ))
                  )
                )}
              </div>
            </div>
          </div>

          {/* Right: map */}
          <div className="lg:col-span-2">
            <BoundaryMap
              geojson={boundariesRes || { type: 'FeatureCollection', features: [] }}
              height={600}
              emptyText={parentReady ? 'No boundaries uploaded yet for this scope.' : 'Select a scope to view boundaries.'}
            />
          </div>
        </div>
      </div>

      {uploadingEntity && (
        <UploadSingleModal level={level} entity={uploadingEntity} onClose={() => setUploadingEntity(null)} />
      )}
    </div>
  );
}
