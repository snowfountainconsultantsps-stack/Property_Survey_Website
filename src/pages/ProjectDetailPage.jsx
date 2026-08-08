import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, XCircle, Trash2, Eye, X,
  Layers, Ruler, Flag, Database, MapPin, Filter, Loader2,
} from 'lucide-react';
import Spinner, { Skeleton } from '../components/Spinner';
import toast from 'react-hot-toast';
import AssetLayerMap from '../components/AssetLayerMap';
import {
  useGetProjectQuery,
  useGetProjectSummaryQuery,
  useGetCategoriesQuery,
  useGetAssetMapQuery,
  useGetUploadsQuery,
  useGetUploadFeaturesQuery,
  useUpdateFeatureMutation,
  useDeleteFeatureMutation,
  useUploadAssetFileMutation,
  usePublishUploadMutation,
  useRejectUploadMutation,
  useDeleteUploadMutation,
  useMatchUploadAreasMutation,
} from '../store/api/assetApi';
import { useGetLocationTreeQuery } from '../store/api/locationApi';
import { useGetBoundariesQuery } from '../store/api/boundaryApi';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/';

const UPLOAD_STATUS = {
  PENDING_REVIEW: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400',
  VERIFIED: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
  PUBLISHED: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
  REJECTED: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
};

const fmtLen = (m) => (!m ? '—' : m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);

// A total on its own doesn't say much when a project holds sewer lines, water
// mains and roads at once — 14 km of *what*? `breakdown` names the layers that
// make up the number, biggest first.
const BREAKDOWN_ROWS = 3;

function StatTile({ icon: Icon, label, value, color, breakdown = [], note, empty, loading = false, ready = true }) {
  const top = breakdown.slice(0, BREAKDOWN_ROWS);
  const rest = breakdown.length - top.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            {label}
            {loading && <Spinner className="w-3 h-3" />}
          </p>
          {/* First load shows a placeholder; a re-fetch keeps the old number
              readable but dimmed, so it's clear it's about to change rather
              than the tile flashing empty. */}
          {ready ? (
            <p className={`text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {value}
            </p>
          ) : (
            <span className="block mt-2"><Skeleton className="h-6 w-20" /></span>
          )}
        </div>
        <Icon className={`w-9 h-9 ${color} opacity-30 flex-shrink-0`} />
      </div>

      {top.length > 0 ? (
        <ul className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 space-y-1">
          {top.map((b) => (
            <li key={b.key} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-gray-500 dark:text-gray-400" title={b.label}>{b.label}</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums whitespace-nowrap">
                {b.value}
              </span>
            </li>
          ))}
          {rest > 0 && (
            <li className="text-[11px] text-gray-400 dark:text-gray-500">
              +{rest} more layer{rest === 1 ? '' : 's'}
            </li>
          )}
          {note && <li className="text-[11px] text-gray-400 dark:text-gray-500 pt-0.5">{note}</li>}
        </ul>
      ) : (
        // With nothing to break down, the note still has to say which assets
        // were looked at — "no line assets" alone reads as missing data rather
        // than "the only layer here is polygons".
        (note || empty) && (
          <p className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs text-gray-400 dark:text-gray-500">
            {empty || note}
          </p>
        )
      )}
    </div>
  );
}

// ─── Upload panel ──────────────────────────────────────────────
function UploadPanel({ projectId, categories }) {
  const [layerId, setLayerId] = useState('');
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  // Last batch's area-match result, kept on screen after the toast fades —
  // an unmatched count is the thing worth acting on.
  const [lastAreas, setLastAreas] = useState(null);
  const [uploadAsset, { isLoading }] = useUploadAssetFileMutation();

  const submit = async (e) => {
    e.preventDefault();
    if (!layerId) return toast.error('Choose a layer');
    if (!file) return toast.error('Choose a .zip shapefile or .geojson file');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', String(projectId));
    if (notes) fd.append('notes', notes);

    const t = toast.loading('Uploading & parsing…');
    try {
      const res = await uploadAsset({ layerId, formData: fd }).unwrap();
      toast.dismiss(t);
      toast.success(`Staged ${res.data.staged} feature(s)`);
      setLastAreas({ staged: res.data.staged, ...(res.data.areas || {}) });
      setFile(null);
      setNotes('');
      e.target.reset();
    } catch (err) {
      toast.dismiss(t);
      toast.error(err?.data?.message || 'Upload failed');
    }
  };

  return (
    <form onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Upload assets</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Layer</label>
        <select value={layerId} onChange={(e) => setLayerId(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">Select a layer…</option>
          {categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {(c.layers || []).map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.geometry_type})</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File (.zip shapefile or .geojson)</label>
        <input type="file" accept=".zip,.geojson,.json"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-400 file:font-semibold hover:file:bg-blue-100 dark:hover:file:bg-blue-900" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="source / date" />
      </div>

      {/* No ward picker: one ward for a file that spans the whole ULB was wrong
          for most of it, and a missing ward hid the features from every
          surveyor allocation. */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-3 py-2">
        <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          Zone, ward and locality are matched from each feature's own geometry against this project's
          boundaries — so a file covering the whole ULB files itself correctly, ward by ward.
        </p>
      </div>

      <button type="submit" disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {isLoading ? 'Uploading, parsing & matching areas…' : 'Upload to staging'}
      </button>

      {lastAreas && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs space-y-1">
          <p className="font-semibold text-gray-700 dark:text-gray-200">Last batch: {lastAreas.staged} staged</p>
          <p className="text-gray-500 dark:text-gray-400">
            {lastAreas.matched || 0} matched to {lastAreas.wards_touched || 0} ward(s)
            {lastAreas.zones_touched ? `, ${lastAreas.zones_touched} zone(s)` : ''}
            {lastAreas.localities_touched ? `, ${lastAreas.localities_touched} locality(ies)` : ''}
          </p>
          {lastAreas.unmatched > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              {lastAreas.unmatched} fell outside every ward boundary — they'll be missing from ward
              filters and surveyor allocations until the covering boundaries are imported.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">Imported features are staged for review, then you publish them to make them live for surveyors.</p>
    </form>
  );
}

// ─── Area filter + boundary overlays ───────────────────────────
// Assets are stamped with the zone/ward/locality they fall in at import time
// (backend services/areaMatch.js), so the map can be narrowed to one area and
// the boundaries themselves can be laid over the assets for context.
//
// Levels that hold nothing for this project are not rendered at all — an empty
// "Locality" dropdown would imply the data is missing rather than optional.
const OVERLAY_STYLES = {
  zone: { label: 'Zones', color: '#f59e0b', level: 'ZONE' },
  ward: { label: 'Wards', color: '#38bdf8', level: 'WARD' },
  locality: { label: 'Localities', color: '#f472b6', level: 'LOCALITY' },
};

function AreaFilterBar({
  area, setArea, zones, wards, localities, overlays, setOverlays, resultNote,
  busy = false, areasLoading = false, overlayLoading = {},
}) {
  // Picking a coarser level clears everything below it, or the map would show
  // "Zone 2 + a ward from Zone 4" and return nothing.
  const pick = (level) => (e) => {
    const value = e.target.value;
    setArea((prev) => ({
      ...prev,
      ...(level === 'zone_id' ? { zone_id: value, ward_id: '', locality_id: '' } : {}),
      ...(level === 'ward_id' ? { ward_id: value, locality_id: '' } : {}),
      ...(level === 'locality_id' ? { locality_id: value } : {}),
    }));
  };

  const toggleOverlay = (key) =>
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));

  const active = Boolean(area.zone_id || area.ward_id || area.locality_id);
  const select =
    'text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <Filter className="w-4 h-4 text-gray-400" /> Area
      </span>

      {areasLoading && zones.length === 0 && wards.length === 0 && (
        <Spinner label="Loading areas…" />
      )}

      {zones.length > 0 && (
        <select value={area.zone_id} onChange={pick('zone_id')} className={select}>
          <option value="">All zones</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      )}
      {wards.length > 0 && (
        <select value={area.ward_id} onChange={pick('ward_id')} className={select}>
          <option value="">All wards</option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>{w.ward_name || `Ward ${w.ward_number}`}</option>
          ))}
        </select>
      )}
      {localities.length > 0 && (
        <select value={area.locality_id} onChange={pick('locality_id')} className={select}>
          <option value="">All localities</option>
          {localities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
      {!areasLoading && zones.length === 0 && wards.length === 0 && (
        <span className="text-sm text-gray-400 dark:text-gray-500">
          No zones or wards under this project's ULB yet.
        </span>
      )}

      {/* The map, the totals and the staged batch all re-fetch on a filter
          change — say so once here rather than leaving three panels to look
          independently stuck. */}
      {busy && <Spinner label="Applying filter…" />}

      {active && (
        <button
          onClick={() => setArea({ zone_id: '', ward_id: '', locality_id: '' })}
          className="text-sm flex items-center gap-1 px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
        >
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      )}

      <div className="flex items-center gap-3 ml-auto">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Show boundaries</span>
        {Object.entries(OVERLAY_STYLES).map(([key, cfg]) => (
          <label key={key} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={overlays[key]}
              onChange={() => toggleOverlay(key)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="inline-block w-4 h-0 border-t-2 border-dashed" style={{ borderColor: cfg.color }} />
            {cfg.label}
            {/* Boundary polygons are fetched on toggle, so the checkbox ticks
                before anything appears on the map. */}
            {overlayLoading[key] && <Spinner className="w-3 h-3" />}
          </label>
        ))}
      </div>

      {resultNote && (
        <p className="w-full text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2">
          {resultNote}
        </p>
      )}
    </div>
  );
}

// ─── Edit/delete a single staged feature ────────────────────────
// Properties returned by the API are the raw imported dbf/GeoJSON fields
// merged with these system columns — keep the editable field list to just
// the raw ones.
const FEATURE_SYSTEM_KEYS = [
  'id', 'layer_id', 'project_id', 'zone_id', 'ward_id', 'locality_id', 'polygon_id',
  'feature_code', 'source', 'status', 'length_m', 'area_sqm', 'upload_id',
];

function EditFeatureModal({ feature, areaNames, onClose }) {
  const p = feature.properties || {};
  const [featureCode, setFeatureCode] = useState(p.feature_code || '');
  const [fields, setFields] = useState(() => {
    const f = {};
    Object.entries(p).forEach(([k, v]) => {
      if (!FEATURE_SYSTEM_KEYS.includes(k)) f[k] = v ?? '';
    });
    return f;
  });
  const [updateFeature, { isLoading: saving }] = useUpdateFeatureMutation();
  const [deleteFeature, { isLoading: deleting }] = useDeleteFeatureMutation();

  const setField = (k) => (e) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const fieldKeys = Object.keys(fields);

  const save = async (e) => {
    e.preventDefault();
    try {
      await updateFeature({ id: p.id, feature_code: featureCode, properties: fields }).unwrap();
      toast.success('Feature updated');
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update feature');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this feature? This cannot be undone.')) return;
    try {
      await deleteFeature(p.id).unwrap();
      toast.success('Feature deleted');
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete feature');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Feature #{p.id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {/* Read-only: the area comes from the geometry, so it's corrected by
              fixing a boundary and re-matching, not by typing here. */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2">
            {[
              ['Zone', areaNames?.zone?.[p.zone_id], p.zone_id],
              ['Ward', areaNames?.ward?.[p.ward_id], p.ward_id],
              ['Locality', areaNames?.locality?.[p.locality_id], p.locality_id],
            ].map(([label, name, id]) =>
              id ? (
                <span key={label} className="text-gray-500 dark:text-gray-400">
                  {label}: <b className="text-gray-800 dark:text-gray-200">{name || `#${id} (not found)`}</b>
                </span>
              ) : null
            )}
            {!p.zone_id && !p.ward_id && !p.locality_id && (
              <span className="text-amber-600 dark:text-amber-400">
                Not inside any ward boundary — hidden from ward filters and surveyor allocations.
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Feature Code</label>
            <input value={featureCode} onChange={(e) => setFeatureCode(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>

          {fieldKeys.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Attributes</p>
              {fieldKeys.map((k) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{k}</label>
                  <input value={fields[k] ?? ''} onChange={setField(k)}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <button type="button" onClick={remove} disabled={deleting}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 text-sm font-medium disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting…' : 'Delete feature'}
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { data: projectRes } = useGetProjectQuery(id);
  // One zone/ward/locality selection drives the published map, the staged
  // batch being reviewed, and the totals — so what's counted is always what's
  // drawn. Empty string means "no filter at this level".
  const [area, setArea] = useState({ zone_id: '', ward_id: '', locality_id: '' });
  const areaParams = useMemo(
    () => Object.fromEntries(Object.entries(area).filter(([, v]) => v)),
    [area]
  );

  const { data: summaryRes, isFetching: summaryLoading } = useGetProjectSummaryQuery({ id, ...areaParams });
  const { data: catRes } = useGetCategoriesQuery();
  const { data: mapRes, isFetching: mapLoading } = useGetAssetMapQuery({
    projectId: id,
    status: 'PUBLISHED',
    ...areaParams,
  });
  const { data: uploadsRes, isFetching: uploadsLoading } = useGetUploadsQuery(id);

  const [reviewUploadId, setReviewUploadId] = useState(null);
  const { data: reviewFeatRes, isFetching: reviewLoading } = useGetUploadFeaturesQuery(
    { uploadId: reviewUploadId, ...areaParams },
    { skip: !reviewUploadId }
  );
  const mapSectionRef = useRef(null);

  const toggleReview = (uploadId) => {
    const opening = reviewUploadId !== uploadId;
    setReviewUploadId(opening ? uploadId : null);
    if (opening) {
      requestAnimationFrame(() =>
        mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    }
  };

  const [publishUpload] = usePublishUploadMutation();
  const [rejectUpload] = useRejectUploadMutation();
  const [deleteUpload] = useDeleteUploadMutation();
  const [matchUploadAreas] = useMatchUploadAreasMutation();
  const [deleteFeature] = useDeleteFeatureMutation();
  const [editingFeature, setEditingFeature] = useState(null);

  const handleDeleteFeature = async (feature) => {
    if (!window.confirm('Delete this feature? This cannot be undone.')) return;
    try {
      await deleteFeature(feature.properties.id).unwrap();
      toast.success('Feature deleted');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete feature');
    }
  };

  const project = projectRes?.data;

  // Areas available to filter by: everything under this project's ULB. The
  // ward list narrows to the chosen zone and localities to the chosen ward, so
  // the three dropdowns can't be set to a combination that holds nothing.
  const { data: treeRes, isFetching: areasLoading } = useGetLocationTreeQuery();
  const { zones, wards, localities } = useMemo(() => {
    const t = treeRes?.data || {};
    const ulbId = project?.ulb_id;
    const z = (t.zones || []).filter((r) => !ulbId || String(r.ulb_id) === String(ulbId));
    let w = (t.wards || []).filter((r) => !ulbId || String(r.ulb_id) === String(ulbId));
    if (area.zone_id) w = w.filter((r) => String(r.zone_id) === String(area.zone_id));
    const wardIds = new Set(w.map((r) => String(r.id)));
    let l = (t.localities || []).filter((r) => wardIds.has(String(r.ward_id)));
    if (area.ward_id) l = l.filter((r) => String(r.ward_id) === String(area.ward_id));
    return { zones: z, wards: w, localities: l };
  }, [treeRes, project?.ulb_id, area.zone_id, area.ward_id]);

  // Boundary overlays are fetched only while switched on — a locality layer is
  // 43 polygons this page has no reason to carry otherwise.
  const [overlays, setOverlays] = useState({ zone: false, ward: false, locality: false });
  const ulbId = project?.ulb_id;
  const { data: zoneBounds, isFetching: zoneBoundsLoading } = useGetBoundariesQuery(
    { level: 'ZONE', parentId: ulbId },
    { skip: !overlays.zone || !ulbId }
  );
  const { data: wardBounds, isFetching: wardBoundsLoading } = useGetBoundariesQuery(
    { level: 'WARD', parentId: ulbId },
    { skip: !overlays.ward || !ulbId }
  );
  const { data: localityBounds, isFetching: localityBoundsLoading } = useGetBoundariesQuery(
    // Localities hang off a ward, so they can only be parent-scoped once one
    // is chosen; otherwise take them all and filter to this ULB's wards below.
    { level: 'LOCALITY', parentId: area.ward_id || undefined },
    { skip: !overlays.locality }
  );

  const mapOverlays = useMemo(() => {
    const out = [];
    const add = (key, res, keep) => {
      if (!overlays[key] || !res?.features) return;
      const features = keep ? res.features.filter(keep) : res.features;
      if (features.length) {
        out.push({
          id: key,
          name: OVERLAY_STYLES[key].label,
          color: OVERLAY_STYLES[key].color,
          geojson: { type: 'FeatureCollection', features },
        });
      }
    };
    // When a level is filtered, show only that area's outline — the point of
    // the overlay is to frame what's on screen.
    add('zone', zoneBounds, area.zone_id ? (f) => String(f.id) === String(area.zone_id) : null);
    add('ward', wardBounds, area.ward_id
      ? (f) => String(f.id) === String(area.ward_id)
      : (f) => wards.some((w) => String(w.id) === String(f.id)));
    add('locality', localityBounds, area.locality_id
      ? (f) => String(f.id) === String(area.locality_id)
      : (f) => localities.some((l) => String(l.id) === String(f.id)));
    return out;
  }, [overlays, zoneBounds, wardBounds, localityBounds, area, wards, localities]);

  // id → name for every area in the hierarchy (not just the ones surviving the
  // current filter), so a feature popup can name where it sits.
  const areaNames = useMemo(() => {
    const t = treeRes?.data || {};
    const index = (rows, nameOf) =>
      Object.fromEntries((rows || []).map((r) => [r.id, nameOf(r)]));
    return {
      zone: index(t.zones, (z) => z.name),
      ward: index(t.wards, (w) => w.ward_name || `Ward ${w.ward_number}`),
      locality: index(t.localities, (l) => l.name),
    };
  }, [treeRes]);

  const areaLabel = useMemo(() => {
    const parts = [];
    const z = zones.find((r) => String(r.id) === String(area.zone_id));
    const w = wards.find((r) => String(r.id) === String(area.ward_id));
    const l = localities.find((r) => String(r.id) === String(area.locality_id));
    if (z) parts.push(z.name);
    if (w) parts.push(w.ward_name || `Ward ${w.ward_number}`);
    if (l) parts.push(l.name);
    return parts.join(' › ');
  }, [area, zones, wards, localities]);

  // Distinguishes "still arriving" from "arrived and it's zero" — a tile
  // showing a confident 0 during the first load is a lie.
  const summaryReady = Boolean(summaryRes?.data);
  const totals = summaryRes?.data?.totals || { features: 0, length_m: 0, published: 0, flagged: 0 };
  const byLayer = summaryRes?.data?.by_layer || [];

  // Which layers actually contribute to each headline number, biggest first.
  // A layer holding nothing is noise on a tile, so it's dropped rather than
  // listed as a zero.
  const { activeLayers, uploadedByLayer, lengthByLayer, publishedByLayer, flaggedByLayer } = useMemo(() => {
    const rows = (summaryRes?.data?.by_layer || []).filter((r) => Number(r.feature_count) > 0);
    const contributors = (valueOf, format) =>
      rows
        .map((r) => ({ key: r.layer_id, label: r.layer_name, raw: Number(valueOf(r) || 0) }))
        .filter((r) => r.raw > 0)
        .sort((a, b) => b.raw - a.raw)
        .map((r) => ({ ...r, value: format(r.raw) }));

    return {
      activeLayers: rows,
      uploadedByLayer: contributors((r) => r.feature_count, (n) => n.toLocaleString()),
      lengthByLayer: contributors((r) => r.total_length_m, fmtLen),
      publishedByLayer: contributors((r) => r.published, (n) => n.toLocaleString()),
      flaggedByLayer: contributors((r) => r.flagged, (n) => n.toLocaleString()),
    };
  }, [summaryRes]);

  // Which asset types were actually looked at, for the tiles that come back
  // empty — "nothing flagged" means little without saying flagged in what.
  const layerSummary = useMemo(() => {
    const names = activeLayers.map((r) => r.layer_name);
    const list = names.length <= 2 ? names.join(' & ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
    const lineLayers = activeLayers.filter((r) => r.geometry_type === 'LINESTRING');
    const geomNote = activeLayers.length === 1
      ? `${activeLayers[0].layer_name} is ${String(activeLayers[0].geometry_type).toLowerCase()}`
      : `no line assets among ${list}`;
    return { names, list, hasLines: lineLayers.length > 0, geomNote, any: names.length > 0 };
  }, [activeLayers]);
  const categories = catRes?.data || [];
  const uploads = uploadsRes?.data || [];

  // Flat catalog for style lookups.
  const layerById = useMemo(() => {
    const m = {};
    categories.forEach((c) => (c.layers || []).forEach((l) => (m[l.id] = l)));
    return m;
  }, [categories]);

  const reviewUpload = uploads.find((u) => u.id === reviewUploadId);

  // Once the reviewed batch actually goes live, there's nothing left to
  // review — close the banner even if it was published from elsewhere
  // (e.g. the list row's Publish button) rather than the banner itself.
  useEffect(() => {
    if (reviewUpload?.status === 'PUBLISHED') setReviewUploadId(null);
  }, [reviewUpload?.status]);

  const reviewLayers = useMemo(() => {
    if (!reviewUpload || !reviewFeatRes) return [];
    const meta = layerById[reviewUpload.layer_id] || reviewUpload.layer || {};
    return [{
      id: meta.id || reviewUpload.layer_id,
      name: meta.name || 'Staged features',
      geometry_type: meta.geometry_type,
      style: meta.style || { color: '#f59e0b', weight: 3, fillColor: '#f59e0b', fillOpacity: 0.35, radius: 6 },
      geojson: { type: 'FeatureCollection', features: reviewFeatRes.features || [] },
      feature_count: reviewFeatRes.count,
    }];
  }, [reviewUpload, reviewFeatRes, layerById]);

  const openReport = async () => {
    const t = toast.loading('Generating report…');
    try {
      const r = await fetch(`${API_BASE}assets/reports/project/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!r.ok) throw new Error('Failed');
      const blob = await r.blob();
      window.open(URL.createObjectURL(blob), '_blank');
      toast.dismiss(t);
    } catch {
      toast.dismiss(t);
      toast.error('Could not generate report');
    }
  };

  // The server's own summary is the useful message here ("8/10 now carry a
  // ward…"), so it's shown rather than a generic success line.
  const rematch = (uploadId) => async () => {
    const t = toast.loading('Matching areas…');
    try {
      const res = await matchUploadAreas(uploadId).unwrap();
      toast.dismiss(t);
      toast.success(res.message || 'Areas re-matched');
    } catch (err) {
      toast.dismiss(t);
      toast.error(err?.data?.message || 'Could not match areas');
    }
  };

  const act = (fn, uploadId, ok, opts = {}) => async () => {
    try {
      await fn(uploadId).unwrap();
      toast.success(ok);
      if (uploadId === reviewUploadId) setReviewUploadId(null);
      if (opts.scrollToMap) {
        requestAnimationFrame(() =>
          mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        );
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Action failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin/projects" className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{project?.name || 'Project'}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{project?.code} · {project?.status}</p>
            </div>
          </div>
          <button onClick={openReport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition">
            <FileText className="w-4 h-4" /> Report PDF
          </button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Summary tiles — each headline number names the layers behind it,
            and counts only the filtered area when one is chosen. */}
        {areaLabel && (
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2">
            <Filter className="w-4 h-4" />
            Totals below are for <b>{areaLabel}</b> only.
            <button
              onClick={() => setArea({ zone_id: '', ward_id: '', locality_id: '' })}
              className="ml-auto text-xs font-semibold hover:underline"
            >
              Show whole project
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={Layers}
            label={areaLabel ? 'Assets in this area' : 'Assets uploaded'}
            value={totals.features.toLocaleString()}
            color="text-blue-500"
            loading={summaryLoading}
            ready={summaryReady}
            breakdown={uploadedByLayer}
            note={uploads.length ? `from ${uploads.length} upload${uploads.length === 1 ? '' : 's'}` : null}
            empty="Nothing uploaded yet"
          />
          <StatTile
            icon={Ruler}
            label="Network length"
            value={layerSummary.hasLines ? fmtLen(totals.length_m) : '—'}
            color="text-emerald-500"
            loading={summaryLoading}
            ready={summaryReady}
            breakdown={lengthByLayer}
            empty={layerSummary.any ? `No length to measure — ${layerSummary.geomNote}` : 'No assets yet'}
          />
          <StatTile
            icon={CheckCircle2}
            label="Published (live)"
            value={totals.published.toLocaleString()}
            color="text-green-500"
            loading={summaryLoading}
            ready={summaryReady}
            breakdown={publishedByLayer}
            empty={layerSummary.any ? `Nothing published in ${layerSummary.list}` : 'No assets yet'}
          />
          <StatTile
            icon={Flag}
            label="Flagged"
            value={totals.flagged.toLocaleString()}
            color="text-red-500"
            loading={summaryLoading}
            ready={summaryReady}
            breakdown={flaggedByLayer}
            empty={layerSummary.any ? `None flagged in ${layerSummary.list}` : 'No assets yet'}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column: upload + uploads list */}
          <div className="space-y-6">
            <UploadPanel projectId={id} categories={categories} />

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Uploads ({uploads.length})</h3>
                {uploadsLoading && <Spinner className="w-3.5 h-3.5" />}
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[420px] overflow-y-auto">
                {uploads.length === 0 && <p className="px-5 py-6 text-sm text-gray-400 dark:text-gray-500">No uploads yet.</p>}
                {uploads.map((u) => (
                  <div key={u.id} className={`px-5 py-3 ${reviewUploadId === u.id ? 'bg-amber-50 dark:bg-amber-950/40' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{u.file_name || `Batch #${u.id}`}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{u.layer?.name} · {u.feature_count} features · {u.source_format}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${UPLOAD_STATUS[u.status] || 'bg-gray-100 dark:bg-gray-700'}`}>
                        {u.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button onClick={() => toggleReview(u.id)}
                        className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900">
                        <Eye className="w-3.5 h-3.5" /> {reviewUploadId === u.id ? 'Hide' : 'Review on map'}
                      </button>
                      {(u.status === 'PENDING_REVIEW' || u.status === 'VERIFIED') && (
                        <>
                          <button onClick={act(publishUpload, u.id, 'Published — features are live', { scrollToMap: true })}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Publish
                          </button>
                          <button onClick={act(rejectUpload, u.id, 'Upload rejected')}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {/* Fills in zone/ward/locality for a batch imported
                          before the covering boundaries existed. */}
                      <button onClick={rematch(u.id)}
                        title="Re-match zone / ward / locality from each feature's geometry"
                        className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900">
                        <MapPin className="w-3.5 h-3.5" /> Re-match areas
                      </button>
                      {u.status !== 'PUBLISHED' && (
                        <button onClick={act(deleteUpload, u.id, 'Upload deleted')}
                          className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: map + inventory */}
          <div className="lg:col-span-2 space-y-6" ref={mapSectionRef}>
            {reviewUploadId && (
              <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-2 text-sm">
                <span className="text-amber-800 dark:text-amber-300">
                  Reviewing staged batch <b>#{reviewUploadId}</b> — {reviewFeatRes?.count ?? '…'} features (not yet live).
                </span>
                <div className="flex gap-2">
                  {reviewUpload && (reviewUpload.status === 'PENDING_REVIEW' || reviewUpload.status === 'VERIFIED') && (
                    <button onClick={act(publishUpload, reviewUploadId, 'Published — features are live', { scrollToMap: true })}
                      className="text-xs font-semibold px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">Publish</button>
                  )}
                  <button onClick={() => setReviewUploadId(null)} className="text-xs px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">Close</button>
                </div>
              </div>
            )}

            {/* Same filter for staged review and published assets — a batch is
                reviewed ward by ward with the same control that narrows the
                live map. */}
            <AreaFilterBar
              area={area}
              setArea={setArea}
              zones={zones}
              wards={wards}
              localities={localities}
              overlays={overlays}
              setOverlays={setOverlays}
              areasLoading={areasLoading}
              busy={mapLoading || summaryLoading || reviewLoading}
              overlayLoading={{
                zone: zoneBoundsLoading,
                ward: wardBoundsLoading,
                locality: localityBoundsLoading,
              }}
              resultNote={
                reviewUploadId
                  ? `Reviewing batch #${reviewUploadId}: showing ${reviewFeatRes?.count ?? '…'}` +
                    `${reviewFeatRes?.areas?.total ? ` of ${reviewFeatRes.areas.total}` : ''} staged feature(s)` +
                    `${areaLabel ? ` in ${areaLabel}` : ''}` +
                    `${reviewFeatRes?.areas?.unmatched
                      ? ` · ${reviewFeatRes.areas.unmatched} in this batch fall outside every ward boundary`
                      : ''}`
                  : areaLabel
                  ? `Published assets in ${areaLabel}: ${totals.published} live of ${totals.features} feature(s).`
                  : null
              }
            />

            <AssetLayerMap
              key={reviewUploadId ? `review-${reviewUploadId}` : 'published'}
              layers={reviewUploadId ? reviewLayers : (mapRes?.layers || [])}
              overlays={mapOverlays}
              areaNames={areaNames}
              loading={reviewUploadId ? reviewLoading : mapLoading}
              loadingText={
                areaLabel
                  ? `Loading ${areaLabel}…`
                  : reviewUploadId
                  ? 'Loading staged features…'
                  : 'Loading assets…'
              }
              height={reviewUploadId ? 460 : 520}
              emptyText={
                reviewUploadId
                  ? 'No staged features to show.'
                  : areaLabel
                  ? `No published assets in ${areaLabel}.`
                  : 'No published assets yet. Upload a shapefile and publish it.'
              }
              editable={!!reviewUploadId}
              onEditFeature={setEditingFeature}
              onDeleteFeature={handleDeleteFeature}
            />

            {/* Inventory by layer */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Inventory by layer</h3>
                {areaLabel && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">· {areaLabel}</span>
                )}
                {summaryLoading && <Spinner className="w-3.5 h-3.5" />}
              </div>
              <div className={`overflow-x-auto transition-opacity ${summaryLoading ? 'opacity-50' : ''}`}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-5 py-2 font-medium">Layer</th>
                      <th className="text-left px-3 py-2 font-medium">Geom</th>
                      <th className="text-right px-3 py-2 font-medium">Count</th>
                      <th className="text-right px-3 py-2 font-medium">Length</th>
                      <th className="text-right px-3 py-2 font-medium">Live</th>
                      <th className="text-right px-5 py-2 font-medium">Flagged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {byLayer.filter((r) => Number(r.feature_count) > 0).map((r) => (
                      <tr key={r.layer_id}>
                        <td className="px-5 py-2 text-gray-800 dark:text-gray-200">{r.layer_name}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.geometry_type}</td>
                        <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200">{r.feature_count}</td>
                        <td className="px-3 py-2 text-right text-gray-800 dark:text-gray-200">{r.geometry_type === 'LINESTRING' ? fmtLen(Number(r.total_length_m)) : '—'}</td>
                        <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{r.published}</td>
                        <td className="px-5 py-2 text-right text-red-500 dark:text-red-400">{r.flagged}</td>
                      </tr>
                    ))}
                    {byLayer.filter((r) => Number(r.feature_count) > 0).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                          {!summaryReady ? (
                            <Spinner label="Loading inventory…" />
                          ) : areaLabel ? (
                            `No assets in ${areaLabel}.`
                          ) : (
                            'No assets yet.'
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editingFeature && (
        <EditFeatureModal
          feature={editingFeature}
          areaNames={areaNames}
          onClose={() => setEditingFeature(null)}
        />
      )}
    </div>
  );
}
