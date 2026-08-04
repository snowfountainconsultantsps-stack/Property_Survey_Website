import { useEffect, useMemo, useState } from 'react';
import { Map as MapIcon, Upload, UploadCloud, X, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import BoundaryMap from '../components/BoundaryMap';
import {
  useGetStatesQuery,
  useGetDistrictsQuery,
  useGetCitiesQuery,
  useGetZonesQuery,
  useGetWardsByZoneQuery,
} from '../store/api/surveyApi';
import {
  useGetBoundariesQuery,
  useUploadSingleBoundaryMutation,
  useBulkUploadBoundariesMutation,
} from '../store/api/boundaryApi';

const LEVELS = [
  { value: 'STATE', label: 'State' },
  { value: 'DISTRICT', label: 'District' },
  { value: 'CITY', label: 'City' },
  { value: 'ZONE', label: 'Zone' },
  { value: 'WARD', label: 'Ward' },
];

const MATCH_FIELDS = {
  STATE: [{ value: 'name', label: 'Name' }, { value: 'code', label: 'Code' }],
  DISTRICT: [{ value: 'name', label: 'Name' }, { value: 'code', label: 'Code' }],
  CITY: [{ value: 'name', label: 'Name' }, { value: 'code', label: 'Code' }],
  ZONE: [{ value: 'name', label: 'Name' }, { value: 'code', label: 'Code' }],
  WARD: [{ value: 'ward_name', label: 'Ward Name' }, { value: 'ward_number', label: 'Ward Number' }],
};

const displayName = (row) => row.name || row.ward_name || '—';
const displayCode = (row) => row.code || row.ward_number || null;

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

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
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
    </div>
  );
}

// ─── Bulk: upload one shapefile with many boundaries, matched by name/code ──
function BulkUploadPanel({ level, parentId, parentLabel }) {
  const [file, setFile] = useState(null);
  const [matchField, setMatchField] = useState(MATCH_FIELDS[level][0].value);
  const [shapefileField, setShapefileField] = useState('');
  const [bulkUpload, { isLoading }] = useBulkUploadBoundariesMutation();
  const [result, setResult] = useState(null);

  useEffect(() => {
    setMatchField(MATCH_FIELDS[level][0].value);
    setResult(null);
  }, [level]);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Choose a .zip shapefile or .geojson file');
    if (!shapefileField.trim()) return toast.error("Enter the shapefile's attribute name to match on");

    const fd = new FormData();
    fd.append('file', file);
    fd.append('match_field', matchField);
    fd.append('shapefile_field', shapefileField.trim());
    if (parentId) fd.append('parent_id', parentId);

    const t = toast.loading('Uploading & matching…');
    try {
      const res = await bulkUpload({ level, formData: fd }).unwrap();
      toast.dismiss(t);
      toast.success(res.message);
      setResult(res.data);
      setFile(null);
    } catch (err) {
      toast.dismiss(t);
      toast.error(err?.data?.message || 'Upload failed');
    }
  };

  return (
    <form onSubmit={submit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Bulk upload boundaries</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        One shapefile with many {level.toLowerCase()} boundaries at once — each feature is matched to an existing
        {' '}{level.toLowerCase()} by name/code{parentLabel ? ` within ${parentLabel}` : ''}.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File (.zip shapefile or .geojson)</label>
        <input type="file" accept=".zip,.geojson,.json"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 dark:file:bg-purple-950 file:text-purple-700 dark:file:text-purple-400 file:font-semibold hover:file:bg-purple-100 dark:hover:file:bg-purple-900" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Match against</label>
          <select value={matchField} onChange={(e) => setMatchField(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none">
            {MATCH_FIELDS[level].map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shapefile attribute</label>
          <input value={shapefileField} onChange={(e) => setShapefileField(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder="e.g. ward_no" />
        </div>
      </div>

      <button type="submit" disabled={isLoading}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 dark:disabled:bg-purple-900 text-white font-semibold py-2.5 rounded-lg transition">
        {isLoading ? 'Uploading…' : 'Upload & Match'}
      </button>

      {result && (
        <div className="text-xs space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-green-600 dark:text-green-400 font-medium">{result.matched.length} matched</p>
          {result.unmatched.length > 0 && (
            <p className="text-red-500 dark:text-red-400">
              {result.unmatched.length} unmatched: {result.unmatched.join(', ')}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

export default function LocationBoundariesPage() {
  const [level, setLevel] = useState('WARD');
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [cityId, setCityId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [uploadingEntity, setUploadingEntity] = useState(null);

  const { data: statesRes } = useGetStatesQuery();
  const states = statesRes?.data || [];

  const { data: districtsRes } = useGetDistrictsQuery(stateId, { skip: !stateId });
  const districts = districtsRes?.data || [];

  const { data: citiesRes } = useGetCitiesQuery(districtId, { skip: !districtId });
  const cities = citiesRes?.data || [];

  const { data: zonesRes } = useGetZonesQuery(cityId, { skip: !cityId });
  const zones = zonesRes?.data || [];

  // Wards hang off a zone now.
  const { data: wardsRes } = useGetWardsByZoneQuery(zoneId, { skip: !zoneId });
  const wards = wardsRes?.data || [];

  const changeLevel = (v) => setLevel(v);
  const changeState = (v) => { setStateId(v); setDistrictId(''); setCityId(''); setZoneId(''); };
  const changeDistrict = (v) => { setDistrictId(v); setCityId(''); setZoneId(''); };
  const changeCity = (v) => { setCityId(v); setZoneId(''); };

  const parentId =
    level === 'DISTRICT' ? stateId :
    level === 'CITY' ? districtId :
    level === 'ZONE' ? cityId :
    level === 'WARD' ? zoneId : null;

  const parentReady = level === 'STATE' || Boolean(parentId);

  const entities =
    level === 'STATE' ? states :
    level === 'DISTRICT' ? districts :
    level === 'CITY' ? cities :
    level === 'ZONE' ? zones : wards;

  const { data: boundariesRes } = useGetBoundariesQuery(
    { level, parentId: parentId || undefined },
    { skip: !parentReady }
  );
  const boundaryIds = useMemo(
    () => new Set((boundariesRes?.features || []).map((f) => f.properties.id)),
    [boundariesRes]
  );

  const parentLabel =
    level === 'DISTRICT' ? states.find((s) => String(s.id) === String(stateId))?.name :
    level === 'CITY' ? districts.find((d) => String(d.id) === String(districtId))?.name :
    level === 'ZONE' ? cities.find((c) => String(c.id) === String(cityId))?.name :
    level === 'WARD' ? zones.find((z) => String(z.id) === String(zoneId))?.name : null;

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
            {(level === 'CITY' || level === 'ZONE' || level === 'WARD') && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">District</label>
                <select value={districtId} onChange={(e) => changeDistrict(e.target.value)} disabled={!stateId}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50">
                  <option value="">Select district…</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
            {(level === 'ZONE' || level === 'WARD') && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">City</label>
                <select value={cityId} onChange={(e) => changeCity(e.target.value)} disabled={!districtId}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50">
                  <option value="">Select city…</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {level === 'WARD' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Zone</label>
                <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} disabled={!cityId}
                  className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50">
                  <option value="">Select zone…</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: bulk upload + entity list */}
          <div className="space-y-6">
            <BulkUploadPanel level={level} parentId={parentId} parentLabel={parentLabel} />

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
                {entities.map((row) => {
                  const hasBoundary = boundaryIds.has(row.id);
                  return (
                    <div key={row.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{displayName(row)}</p>
                        {displayCode(row) && <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{displayCode(row)}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                          hasBoundary
                            ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {hasBoundary ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {hasBoundary ? 'Has boundary' : 'No boundary'}
                        </span>
                        <button onClick={() => setUploadingEntity(row)}
                          className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900">
                          <Upload className="w-3.5 h-3.5" /> Upload
                        </button>
                      </div>
                    </div>
                  );
                })}
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
