import { useMemo, useState } from 'react';
import { X, MapPin, Trash2, Plus, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetLocationTreeQuery } from '../store/api/locationApi';
import { useGetProjectsQuery, useGetAssetStatsQuery } from '../store/api/assetApi';
import {
  useGetAssignmentsQuery,
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
} from '../store/api/assignmentApi';

// Allocate work to one surveyor: a PROJECT first, then an area inside it.
// The pair is what's granted — holding (Project A, Ward 1) gives no access to
// Ward 1 in some other project.
//
// Areas may deliberately be shared between surveyors, so nothing here blocks
// assigning the same ward twice; only the exact same (surveyor, project, area)
// triple is deduplicated, server-side.
export default function AssignAreaModal({ user, onClose }) {
  const [projectId, setProjectId] = useState('');
  const [layerId, setLayerId] = useState(''); // '' = every asset type
  const [level, setLevel] = useState('WARD');
  const [ulbId, setUlbId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [wardId, setWardId] = useState('');
  const [localityId, setLocalityId] = useState('');

  const { data: treeRes, isLoading: treeLoading } = useGetLocationTreeQuery();
  const { data: projectsRes } = useGetProjectsQuery({});
  const projects = projectsRes?.data || [];
  // Asset types to choose from — /assets/stats already lists every layer.
  const { data: statsRes } = useGetAssetStatsQuery();
  const layers = statsRes?.data || [];
  const { data: mineRes, isLoading: mineLoading } = useGetAssignmentsQuery(user.id);
  const [createAssignment, { isLoading: saving }] = useCreateAssignmentMutation();
  const [deleteAssignment] = useDeleteAssignmentMutation();

  const tree = treeRes?.data || {};
  const ulbs = tree.ulbs || [];
  const zones = useMemo(
    () => (tree.zones || []).filter((z) => !ulbId || String(z.ulb_id) === String(ulbId)),
    [tree.zones, ulbId]
  );
  const wards = useMemo(
    () => (tree.wards || []).filter((w) => !ulbId || String(w.ulb_id) === String(ulbId)),
    [tree.wards, ulbId]
  );
  const localities = useMemo(
    () => (tree.localities || []).filter((l) => !wardId || String(l.ward_id) === String(wardId)),
    [tree.localities, wardId]
  );

  const assigned = mineRes?.data || [];

  const submit = async () => {
    if (!projectId) return toast.error('Select a project first');

    const body = { user_id: user.id, level, project_id: projectId };
    if (layerId) body.layer_id = layerId; // omitted → all asset types
    if (level === 'ZONE') body.zone_id = zoneId;
    if (level === 'WARD') body.ward_id = wardId;
    if (level === 'LOCALITY') body.locality_id = localityId;

    const areaId = body.zone_id || body.ward_id || body.locality_id;
    if (!areaId) return toast.error(`Select a ${level.toLowerCase()} to assign`);

    try {
      const res = await createAssignment(body).unwrap();
      toast.success(res.message || 'Area assigned');
      setZoneId(''); setWardId(''); setLocalityId('');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to assign');
    }
  };

  const remove = async (id) => {
    try {
      await deleteAssignment(id).unwrap();
      toast.success('Assignment removed');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to remove');
    }
  };

  const selectCls =
    'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Allocate areas</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {user.full_name} · {user.phone} — the surveyor will only see and be able to survey these areas.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Current allocation */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Currently allocated ({assigned.length})
            </p>
            {mineLoading ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : assigned.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  No area allocated — this surveyor currently sees <strong>no assets at all</strong> in the app.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {assigned.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40"
                  >
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-sm text-gray-800 dark:text-gray-200 flex-1">{a.label}</span>
                    {a.level === 'LOCALITY' && !a.locality_has_boundary && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                        title="This locality has no boundary uploaded, so access is granted at ward level"
                      >
                        WARD-WIDE
                      </span>
                    )}
                    <button
                      onClick={() => remove(a.id)}
                      className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add an allocation</p>

            {/* Project comes first — the grant is the (project, area) pair. */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">1. Project *</p>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectCls}>
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.code ? ` (${p.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Which asset type they must survey there. Blank = all of them. */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">2. Asset type to survey</p>
              <select value={layerId} onChange={(e) => setLayerId(e.target.value)} className={selectCls}>
                <option value="">All asset types in this project</option>
                {layers.map((l) => (
                  <option key={l.layer_id} value={l.layer_id}>
                    {l.layer_name} ({l.geometry_type})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Pick one to restrict this surveyor to e.g. only Property, or only Sewer Line.
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">3. Area within it</p>
            <div className="flex gap-2 mb-3">
              {['ZONE', 'WARD', 'LOCALITY'].map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    level === l
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {l === 'ZONE' ? 'Zone' : l === 'WARD' ? 'Ward' : 'Locality'}
                </button>
              ))}
            </div>

            {treeLoading ? (
              <p className="text-xs text-gray-400">Loading hierarchy…</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ULB (filter)</p>
                  <select value={ulbId} onChange={(e) => { setUlbId(e.target.value); setZoneId(''); setWardId(''); }} className={selectCls}>
                    <option value="">All ULBs</option>
                    {ulbs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                {level === 'ZONE' && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Zone *</p>
                    <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={selectCls}>
                      <option value="">Select zone…</option>
                      {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                )}

                {(level === 'WARD' || level === 'LOCALITY') && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Ward {level === 'WARD' ? '*' : '(to pick a locality)'}
                    </p>
                    <select value={wardId} onChange={(e) => { setWardId(e.target.value); setLocalityId(''); }} className={selectCls}>
                      <option value="">Select ward…</option>
                      {wards.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.ward_name}{w.ward_number ? ` (${w.ward_number})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {level === 'LOCALITY' && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Locality *</p>
                    <select
                      value={localityId}
                      onChange={(e) => setLocalityId(e.target.value)}
                      disabled={!wardId}
                      className={selectCls}
                    >
                      <option value="">{wardId ? 'Select locality…' : 'Pick a ward first'}</option>
                      {localities.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      A locality restricts access precisely only if its boundary has been uploaded;
                      otherwise the surveyor gets the whole ward.
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={submit}
              disabled={saving || !projectId}
              className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Assign
            </button>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
