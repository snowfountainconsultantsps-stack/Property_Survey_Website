import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, XCircle, Trash2, Eye, X,
  Layers, Ruler, Flag, Database, MapPin,
} from 'lucide-react';
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

function StatTile({ icon: Icon, label, value, color, breakdown = [], note, empty }) {
  const top = breakdown.slice(0, BREAKDOWN_ROWS);
  const rest = breakdown.length - top.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
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
        </ul>
      ) : (
        (note || empty) && (
          <p className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs text-gray-400 dark:text-gray-500">
            {note || empty}
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
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold py-2.5 rounded-lg transition">
        {isLoading ? 'Uploading…' : 'Upload to staging'}
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

// ─── Edit/delete a single staged feature ────────────────────────
// Properties returned by the API are the raw imported dbf/GeoJSON fields
// merged with these system columns — keep the editable field list to just
// the raw ones.
const FEATURE_SYSTEM_KEYS = [
  'id', 'layer_id', 'project_id', 'zone_id', 'ward_id', 'locality_id', 'polygon_id',
  'feature_code', 'source', 'status', 'length_m', 'area_sqm', 'upload_id',
];

function EditFeatureModal({ feature, onClose }) {
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
  const { data: summaryRes } = useGetProjectSummaryQuery(id);
  const { data: catRes } = useGetCategoriesQuery();
  const { data: mapRes, isFetching: mapLoading } = useGetAssetMapQuery({ projectId: id, status: 'PUBLISHED' });
  const { data: uploadsRes } = useGetUploadsQuery(id);

  const [reviewUploadId, setReviewUploadId] = useState(null);
  const { data: reviewFeatRes } = useGetUploadFeaturesQuery(reviewUploadId, { skip: !reviewUploadId });
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
  const totals = summaryRes?.data?.totals || { features: 0, length_m: 0, published: 0, flagged: 0 };
  const byLayer = summaryRes?.data?.by_layer || [];

  // Which layers actually contribute to each headline number, biggest first.
  // A layer holding nothing is noise on a tile, so it's dropped rather than
  // listed as a zero.
  const { activeLayers, lengthByLayer, publishedByLayer, flaggedByLayer } = useMemo(() => {
    const rows = (summaryRes?.data?.by_layer || []).filter((r) => Number(r.feature_count) > 0);
    const contributors = (valueOf, format) =>
      rows
        .map((r) => ({ key: r.layer_id, label: r.layer_name, raw: Number(valueOf(r) || 0) }))
        .filter((r) => r.raw > 0)
        .sort((a, b) => b.raw - a.raw)
        .map((r) => ({ ...r, value: format(r.raw) }));

    return {
      activeLayers: rows,
      lengthByLayer: contributors((r) => r.total_length_m, fmtLen),
      publishedByLayer: contributors((r) => r.published, String),
      flaggedByLayer: contributors((r) => r.flagged, String),
    };
  }, [summaryRes]);
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
        {/* Summary tiles — each headline number names the layers behind it. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={Layers}
            label="Total features"
            value={totals.features}
            color="text-blue-500"
            note={activeLayers.length ? `across ${activeLayers.length} layer${activeLayers.length === 1 ? '' : 's'}` : 'No assets yet'}
          />
          <StatTile
            icon={Ruler}
            label="Network length"
            value={fmtLen(totals.length_m)}
            color="text-emerald-500"
            breakdown={lengthByLayer}
            empty="No line assets yet"
          />
          <StatTile
            icon={CheckCircle2}
            label="Published (live)"
            value={totals.published}
            color="text-green-500"
            breakdown={publishedByLayer}
            empty="Nothing published yet"
          />
          <StatTile
            icon={Flag}
            label="Flagged"
            value={totals.flagged}
            color="text-red-500"
            breakdown={flaggedByLayer}
            empty="Nothing flagged"
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

            <AssetLayerMap
              key={reviewUploadId ? `review-${reviewUploadId}` : 'published'}
              layers={reviewUploadId ? reviewLayers : (mapRes?.layers || [])}
              height={reviewUploadId ? 460 : 520}
              emptyText={
                reviewUploadId
                  ? 'Loading staged features…'
                  : mapLoading
                  ? 'Loading map…'
                  : 'No published assets yet. Upload a shapefile and publish it.'
              }
              editable={!!reviewUploadId}
              onEditFeature={setEditingFeature}
              onDeleteFeature={handleDeleteFeature}
            />

            {/* Inventory by layer */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Inventory by layer</h3>
              </div>
              <div className="overflow-x-auto">
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
                      <tr><td colSpan={6} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">No assets yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {editingFeature && (
        <EditFeatureModal feature={editingFeature} onClose={() => setEditingFeature(null)} />
      )}
    </div>
  );
}
