import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, MapPin, User, Calendar, Flag, Home, Image as ImageIcon, Calculator, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AssetLayerMap from '../components/AssetLayerMap';
import TaxBreakdown from '../components/TaxBreakdown';
import {
  useGetProjectsQuery,
  useGetAssetMapQuery,
  useGetFeatureSurveysQuery,
  useGetPropertyTaxQuery,
  useApprovePropertyTaxMutation,
} from '../store/api/assetApi';
import { useGetPropertiesByPolygonQuery } from '../store/api/surveyApi';

const LEGEND = [
  { color: '#22c55e', label: 'Surveyed' },
  { color: '#f59e0b', label: 'In progress' },
  { color: '#ef4444', label: 'Flagged' },
  { color: '#9ca3af', label: 'Not surveyed' },
];

const CONDITION_STYLE = {
  GOOD: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
  FAIR: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
  POOR: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
  DAMAGED: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
  MISSING: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

// ── Generic property-tree renderer ────────────────────────────
// The property survey spans ~12 tables (owners, utilities, roads, photos,
// building → floors → utilities/occupancy/units → owners/utilities/photos).
// Rather than hard-code each, we walk whatever the API returns so Single- and
// Multi-storey — and any future field — all render.
const OMIT_KEYS = new Set([
  'id', 'createdAt', 'updatedAt', 'property_id', 'building_id', 'floor_id',
  'unit_id', 'polygon_id', 'surveyor_id', 'survey_id', 'project_id',
]);
const isScalar = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const isPhotoUrl = (k) => /photo_url|image_url|thumbnail|^url$/i.test(k);
const isEmpty = (v) => v === null || v === undefined || v === '';
const humanize = (k) =>
  k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const fmtVal = (v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));

function ScalarGrid({ record }) {
  const entries = Object.entries(record).filter(
    ([k, v]) => isScalar(v) && !OMIT_KEYS.has(k) && !isPhotoUrl(k) && !isEmpty(v)
  );
  if (!entries.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {entries.map(([k, v]) => (
        <div key={k}>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{humanize(k)}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{fmtVal(v)}</p>
        </div>
      ))}
    </div>
  );
}

function PhotoRow({ record }) {
  const urls = Object.entries(record).filter(([k, v]) => isPhotoUrl(k) && v).map(([, v]) => v);
  if (!urls.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noreferrer">
          <img src={u} alt="Survey"
            className="w-20 h-20 object-cover rounded border border-gray-200 dark:border-gray-700 hover:opacity-80" />
        </a>
      ))}
    </div>
  );
}

// One record: its own fields + photos, then each nested association recursively.
function RecordBody({ record }) {
  const nested = Object.entries(record).filter(([, v]) => v && typeof v === 'object' && !isScalar(v));
  return (
    <>
      <ScalarGrid record={record} />
      <PhotoRow record={record} />
      {nested.map(([k, v]) => <NestedSection key={k} label={humanize(k)} value={v} />)}
    </>
  );
}

function NestedSection({ label, value }) {
  const items = (Array.isArray(value) ? value : [value]).filter((it) => it && typeof it === 'object');
  if (!items.length) return null;
  const many = Array.isArray(value) && value.length > 1;
  return (
    <div className="mt-3 border-l-2 border-blue-200 dark:border-blue-900 pl-3">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2">
        {label}{many ? ` (${items.length})` : ''}
      </p>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3">
            {many && <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">#{i + 1}</p>}
            <RecordBody record={it} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Computed tax for one property + the admin approve action. The admin sees the
// full derivation and, on approval, freezes it so citizens can view it.
function TaxAssessmentPanel({ propertyId }) {
  const { data, isFetching, isError } = useGetPropertyTaxQuery(propertyId, { skip: !propertyId });
  const [approve, { isLoading: approving }] = useApprovePropertyTaxMutation();

  const computed = data?.data?.computed;
  const assessment = data?.data?.assessment;
  const approved = assessment?.status === 'APPROVED';

  const onApprove = async () => {
    try {
      await approve(propertyId).unwrap();
      toast.success('Tax assessment approved — now visible to the citizen.');
    } catch (e) {
      toast.error(e?.data?.message || 'Failed to approve tax.');
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
          <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Tax Assessment
        </span>
        {approved ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
            {assessment?.approved_at ? ` · ${new Date(assessment.approved_at).toLocaleDateString()}` : ''}
          </span>
        ) : (
          <button onClick={onApprove} disabled={approving || isFetching || !computed}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white transition">
            {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {approving ? 'Approving…' : 'Approve tax'}
          </button>
        )}
      </div>
      <div className="p-4">
        {isFetching && <p className="text-sm text-gray-500 dark:text-gray-400">Calculating tax…</p>}
        {isError && <p className="text-sm text-red-600 dark:text-red-400">Could not calculate tax. Is the backend restarted?</p>}
        {computed && <TaxBreakdown breakdown={computed} />}
        {approved && (
          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
            Approved value frozen at {new Date(assessment.approved_at).toLocaleString()}. Re-approving recalculates from the current survey.
          </p>
        )}
      </div>
    </div>
  );
}

// Full property tree for a parcel (one entry, or several for Multi-storey /
// Commercial-complex which allow multiple properties per polygon).
function PropertyFullDetail({ properties }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {properties.map((p, i) => (
        <div key={p.id || i} className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
              <Home className="w-3 h-3" /> Property survey
            </span>
            <h4 className="font-bold text-gray-900 dark:text-gray-100">
              {properties.length > 1 ? `#${i + 1} · ` : ''}
              {[p.property_type, p.property_subtype].filter(Boolean).join(' / ') || 'Property'}
            </h4>
            {p.property_code && <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{p.property_code}</span>}
          </div>
          <RecordBody record={p} />
          {p.id && <TaxAssessmentPanel propertyId={p.id} />}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

// Everything recorded for one asset: the answers, who recorded them, and photos.
// Falls back to the parcel's full property survey when there's no asset survey.
function SurveyDetail({ featureId, featureProps }) {
  const { data, isFetching } = useGetFeatureSurveysQuery(featureId, { skip: !featureId });
  const surveys = data?.data || [];
  const schema = data?.layer?.attribute_schema || [];

  // Only look up the property survey once we know the asset endpoint is empty
  // and the feature is tied to a parcel polygon.
  const polygonId = featureProps?.polygon_id || null;
  const wantProperty = !!polygonId && !isFetching && surveys.length === 0;
  const { data: propData, isFetching: propFetching } =
    useGetPropertiesByPolygonQuery(polygonId, { skip: !wantProperty });
  const properties = propData?.data || [];

  if (isFetching || (wantProperty && propFetching)) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 px-5 py-6">Loading survey…</p>;
  }

  if (!surveys.length && properties.length) {
    return <PropertyFullDetail properties={properties} />;
  }

  if (!surveys.length) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This asset hasn&apos;t been surveyed yet.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Values shown on the map come from the original upload.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {surveys.map((s) => {
        const answers = s.proposed_properties || {};
        // Only show questions that were actually answered.
        const answered = schema.filter(
          (f) => answers[f.key] !== undefined && answers[f.key] !== null && answers[f.key] !== ''
        );
        return (
          <div key={s.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {s.condition && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${CONDITION_STYLE[s.condition] || 'bg-gray-100 dark:bg-gray-700'}`}>
                  {s.condition}
                </span>
              )}
              {s.action === 'FLAG' && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
                  <Flag className="w-3 h-3" /> Problem reported
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <User className="w-3.5 h-3.5" />
                {s.surveyor?.full_name || 'Unknown surveyor'}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(s.createdAt).toLocaleString()}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{s.status}</span>
            </div>

            {answered.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {answered.map((f) => (
                  <div key={f.key}>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {f.label}{f.unit ? ` (${f.unit})` : ''}
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {typeof answers[f.key] === 'boolean'
                        ? answers[f.key] ? 'Yes' : 'No'
                        : String(answers[f.key])}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                No attribute answers recorded.
              </p>
            )}

            {s.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded p-2 mb-3">
                {s.notes}
              </p>
            )}

            {(s.photos || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {s.photos.map((ph) => (
                  <a key={ph.id} href={ph.photo_url} target="_blank" rel="noreferrer">
                    <img src={ph.photo_url} alt="Survey"
                      className="w-20 h-20 object-cover rounded border border-gray-200 dark:border-gray-700 hover:opacity-80" />
                  </a>
                ))}
              </div>
            )}

            {(s.gps_lat || s.gps_lng) && (
              <p className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                <MapPin className="w-3 h-3" />
                Recorded at {Number(s.gps_lat).toFixed(5)}, {Number(s.gps_lng).toFixed(5)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SurveyedDataPage() {
  const { data: projectsRes } = useGetProjectsQuery({});
  const projects = projectsRes?.data || [];

  const [projectId, setProjectId] = useState('');
  const [layerId, setLayerId] = useState('');
  const [selected, setSelected] = useState(null);

  // status=ALL so unsurveyed assets still appear (greyed) for context.
  const { data: mapRes, isFetching } = useGetAssetMapQuery(
    { projectId, status: 'ALL' },
    { skip: !projectId }
  );
  const allLayers = useMemo(
    () => (mapRes?.layers || []).filter((l) => (l.geojson?.features?.length || 0) > 0),
    [mapRes]
  );

  // Reset the drill-down whenever the scope above it changes.
  useEffect(() => { setLayerId(''); setSelected(null); }, [projectId]);
  useEffect(() => { setSelected(null); }, [layerId]);

  const layer = allLayers.find((l) => String(l.id) === String(layerId));
  const shown = layer ? [layer] : [];

  const counts = useMemo(() => {
    const feats = layer?.geojson?.features || [];
    let done = 0, progress = 0, flagged = 0;
    feats.forEach((f) => {
      const p = f.properties || {};
      if (p.status === 'FLAGGED') flagged += 1;
      else if (p.survey_state === 'DONE') done += 1;
      else if (p.survey_state === 'IN_PROGRESS') progress += 1;
    });
    return { total: feats.length, done, progress, flagged, pending: feats.length - done - progress - flagged };
  }, [layer]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Surveyed Data</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pick a project and asset type, then click anything on the map to see what was recorded
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        {/* Scope */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Select project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Asset type</label>
            <select value={layerId} onChange={(e) => setLayerId(e.target.value)} disabled={!projectId || isFetching}
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50">
              <option value="">{isFetching ? 'Loading…' : 'Select asset type…'}</option>
              {allLayers.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.feature_count})</option>
              ))}
            </select>
          </div>
        </div>

        {layer && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Stat label="Total" value={counts.total} color="text-gray-900 dark:text-gray-100" />
              <Stat label="Surveyed" value={counts.done} color="text-green-600 dark:text-green-400" />
              <Stat label="In progress" value={counts.progress} color="text-amber-600 dark:text-amber-400" />
              <Stat label="Flagged" value={counts.flagged} color="text-red-600 dark:text-red-400" />
              <Stat label="Not surveyed" value={counts.pending} color="text-gray-500 dark:text-gray-400" />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 flex flex-wrap gap-4">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">Click a feature for its survey</span>
            </div>

            <AssetLayerMap
              layers={shown}
              height={480}
              colorBySurvey
              selectedFeatureId={selected?.properties?.id ?? null}
              onSelectFeature={(f) => setSelected(f)}
              emptyText="No assets of this type in this project."
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">
                  {selected
                    ? `${layer.name} — ${selected.properties.feature_code || `#${selected.properties.id}`}`
                    : 'Survey details'}
                </h3>
              </div>
              {selected ? (
                <SurveyDetail featureId={selected.properties.id} featureProps={selected.properties} />
              ) : (
                <p className="px-5 py-8 text-sm text-gray-400 dark:text-gray-500 text-center">
                  Click any asset on the map to see what the surveyor recorded.
                </p>
              )}
            </div>
          </>
        )}

        {!projectId && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">Select a project to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
