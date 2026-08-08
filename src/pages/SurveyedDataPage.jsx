import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, MapPin, User, Calendar, Flag, Home, Image as ImageIcon, Calculator, CheckCircle2, Loader2, Users, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import AssetLayerMap from '../components/AssetLayerMap';
import TaxBreakdown from '../components/TaxBreakdown';
import Spinner from '../components/Spinner';
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

// ── Owner-wise view for multi-unit buildings ──────────────────────
// A 15-unit complex rendered as one nested tree is unreadable, and it buries
// the thing that actually matters: who owns what. For multi-entry subtypes the
// units are regrouped under their owner instead, collapsed by default.

const MULTI_ENTRY = ['MultiStory', 'CommercialComplex'];

const floorName = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 'Floor';
  if (v === 0) return 'Ground Floor';
  if (v < 0) return `Basement ${Math.abs(v)}`;
  const s = ['th', 'st', 'nd', 'rd'], m = v % 100;
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]} Floor`;
};

// Group every unit in the building by the people who own it. Joint owners of
// one unit stay together as a single group (one liability, several names);
// one person owning several units collapses into one group too.
function unitsByOwner(property) {
  const floors = property?.Building?.Floors || [];
  const groups = new Map();

  for (const f of floors) {
    for (const u of f.Units || []) {
      const owners = (u.UnitOwners || []).filter((o) => o && (o.owner_name || o.mobile));
      const key = owners.length
        ? owners.map((o) => `${o.owner_name}|${o.mobile || ''}`).sort().join(' + ')
        : '__none__';
      if (!groups.has(key)) {
        groups.set(key, {
          owners,
          unassigned: owners.length === 0,
          isJoint: owners.length > 1,
          units: [],
        });
      }
      groups.get(key).units.push({ ...u, _floor: f.floor_number });
    }
  }
  return [...groups.values()].sort((a, b) => b.units.length - a.units.length);
}

function Collapsible({ title, subtitle, badge, badgeTone = 'blue', right, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = {
    blue: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400',
    amber: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
  }[badgeTone];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition"
      >
        <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {title}
            {badge && (
              <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tone}`}>{badge}</span>
            )}
          </p>
          {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </button>
      {open && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Signature used to line a UI owner group up with its row in the tax
// breakdown. Must stay byte-identical to `ownerBreakdown` in the backend's
// services/taxCalculator.js, or the amounts won't attach.
const ownerKey = (owners) =>
  owners.length
    ? owners.map((o) => `${o.owner_name}|${o.mobile || ''}`).sort().join(' + ')
    : '__none__';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function OwnerUnitsSection({ property, taxByOwner, taxYear }) {
  const groups = unitsByOwner(property);
  if (!groups.length) return null;

  return (
    <div className="mt-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2">
        <Users className="w-3.5 h-3.5" />
        Owners &amp; their units ({groups.length})
      </p>
      <div className="space-y-2">
        {groups.map((g, i) => {
          const label = g.unassigned
            ? 'Owner not recorded'
            : g.owners.map((o) => o.owner_name).join(' & ');
          const area = g.units.reduce((s, u) => s + (Number(u.carpet_area) || 0), 0);
          const tax = taxByOwner?.get(ownerKey(g.owners)) || null;
          return (
            <Collapsible
              key={i}
              title={label}
              badge={g.isJoint ? 'JOINT' : g.unassigned ? 'NO OWNER' : null}
              badgeTone={g.unassigned ? 'amber' : 'indigo'}
              subtitle={`${g.units.length} unit${g.units.length === 1 ? '' : 's'} · ${area} m² · ${
                g.units.map((u) => u.unit_number || `#${u.id}`).join(', ')
              }`}
              // Payable is the number people look for — keep it on the header
              // so it's readable without expanding every owner.
              right={
                tax && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{inr(tax.tax)}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{tax.share_pct}% of building</p>
                  </div>
                )
              }
            >
              {/* This owner's demand, derived from their units only. */}
              {tax && (
                <div className="mb-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                      <Calculator className="w-3.5 h-3.5" /> Tax payable {taxYear ? `· ${taxYear}` : ''}
                    </p>
                    <p className="text-lg font-extrabold text-blue-700 dark:text-blue-300">{inr(tax.tax)}</p>
                  </div>
                  <table className="w-full text-[11px]">
                    <tbody className="divide-y divide-blue-200/60 dark:divide-blue-900/60">
                      {tax.spaces?.map((s, j) => (
                        <tr key={j}>
                          <td className="py-1 text-gray-700 dark:text-gray-300">{s.label}</td>
                          <td className="py-1 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {s.area_sqm} m² · {s.occupancy}
                          </td>
                          <td className="py-1 text-right font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap pl-3">
                            ARV {inr(s.arv)}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td className="pt-1.5 text-gray-800 dark:text-gray-200" colSpan={2}>
                          Rateable value (ARV) · {tax.share_pct}% share of building
                        </td>
                        <td className="pt-1.5 text-right text-gray-900 dark:text-gray-100 whitespace-nowrap pl-3">
                          {inr(tax.arv)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200 dark:border-blue-900">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">Final payable</span>
                    <span className="text-base font-extrabold text-blue-700 dark:text-blue-300">{inr(tax.tax)}</span>
                  </div>
                  {g.unassigned && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                      No owner recorded — this demand cannot be issued until one is.
                    </p>
                  )}
                </div>
              )}
              {/* Owner contact details, once per group rather than per unit. */}
              {g.owners.length > 0 && (
                <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 grid sm:grid-cols-2 gap-3">
                  {g.owners.map((o, j) => (
                    <div key={j} className="text-xs">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{o.owner_name}</p>
                      {o.father_or_husband_name && (
                        <p className="text-gray-500 dark:text-gray-400">S/o, W/o {o.father_or_husband_name}</p>
                      )}
                      <p className="text-gray-500 dark:text-gray-400">
                        {[o.occupation, o.mobile, o.aadhar].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {/* Each unit in full — utilities, photos and all. */}
              <div className="space-y-3">
                {g.units.map((u) => (
                  <div key={u.id} className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                      {floorName(u._floor)} · Unit {u.unit_number || u.id}
                    </p>
                    {/* Owners already shown above; drop them from the dump. */}
                    <RecordBody record={(({ UnitOwners, _floor, ...rest }) => rest)(u)} />
                  </div>
                ))}
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

// Floors with no units (parking decks, service floors) still need showing —
// they carry area and are taxed, they just have no owner of their own.
function NonUnitFloors({ property }) {
  const floors = (property?.Building?.Floors || []).filter((f) => !(f.Units || []).length);
  if (!floors.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2">
        Common / non-unit floors ({floors.length})
      </p>
      <div className="space-y-2">
        {floors.map((f) => (
          <Collapsible
            key={f.id}
            title={floorName(f.floor_number)}
            subtitle={[f.floor_use, f.carpet_area ? `${f.carpet_area} m²` : null].filter(Boolean).join(' · ')}
          >
            <RecordBody record={(({ Units, ...rest }) => rest)(f)} />
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

// One surveyed property. The tax is fetched here rather than only inside
// TaxAssessmentPanel so each owner's slice can be shown alongside their units
// — RTK Query dedupes the two calls, so it's still a single request.
function PropertyBlock({ property: p, index, total }) {
  const isMultiUnit =
    MULTI_ENTRY.includes(p.property_subtype) && (p.Building?.Floors || []).length > 0;

  const { data: taxData } = useGetPropertyTaxQuery(p.id, { skip: !p.id || !isMultiUnit });
  const computed = taxData?.data?.computed;

  // Index the tax breakdown by the same owner signature the UI groups on.
  const taxByOwner = useMemo(() => {
    const rows = computed?.owner_breakdown;
    if (!rows?.length) return null;
    const m = new Map();
    rows.forEach((r) => {
      if (r.is_common) return;
      m.set(ownerKey(r.owners || []), r);
    });
    return m;
  }, [computed]);

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
          <Home className="w-3 h-3" /> Property survey
        </span>
        <h4 className="font-bold text-gray-900 dark:text-gray-100">
          {total > 1 ? `#${index + 1} · ` : ''}
          {[p.property_type, p.property_subtype].filter(Boolean).join(' / ') || 'Property'}
        </h4>
        {p.property_code && (
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{p.property_code}</span>
        )}
      </div>

      {isMultiUnit ? (
        <>
          {/* Property + building basics, minus the floor/unit tree — that is
              re-presented owner-wise below instead of as a deep dump. */}
          <RecordBody
            record={{
              ...p,
              Building: p.Building ? (({ Floors, ...rest }) => rest)(p.Building) : null,
            }}
          />
          <OwnerUnitsSection
            property={p}
            taxByOwner={taxByOwner}
            taxYear={computed?.assessment_year}
          />
          <NonUnitFloors property={p} />
        </>
      ) : (
        <RecordBody record={p} />
      )}

      {p.id && <TaxAssessmentPanel propertyId={p.id} />}
    </div>
  );
}

// Full property tree for a parcel (one entry, or several for Multi-storey /
// Commercial-complex which allow multiple properties per polygon).
function PropertyFullDetail({ properties }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {properties.map((p, i) => (
        <PropertyBlock key={p.id || i} property={p} index={i} total={properties.length} />
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
              loading={isFetching}
              loadingText="Loading survey progress…"
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

        {/* A project's assets can run to tens of thousands of features, so the
            gap between picking one and the asset-type list filling in is long
            enough to look broken without this. */}
        {projectId && isFetching && !layer && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <Spinner className="w-6 h-6" label="Loading this project's assets…" />
          </div>
        )}

        {projectId && !isFetching && !layer && allLayers.length > 0 && (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-gray-600 dark:text-gray-300 font-medium">Pick an asset type to see its survey progress</p>
          </div>
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
