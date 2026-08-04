import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, X, MapPin, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useGetProjectsQuery,
  useCreateProjectMutation,
} from '../store/api/assetApi';
import {
  useGetStatesQuery,
  useGetDistrictsQuery,
  useGetCitiesQuery,
} from '../store/api/surveyApi';
import { useGetLocationsQuery } from '../store/api/locationApi';

// Fixed set — matches the intent of "Department dropdown" without a new table.
const DEPARTMENTS = [
  'Water Works',
  'Sewerage',
  'Roads & Transport',
  'Electrical',
  'Health & Sanitation',
  'Revenue',
  'Town Planning',
  'General Administration',
];

const STATUS_STYLES = {
  ACTIVE: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
  ON_HOLD: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400',
  COMPLETED: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
  ARCHIVED: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
};

const selectCls =
  'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50';

function CreateProjectModal({ onClose }) {
  const [form, setForm] = useState({
    name: '', description: '', department: '',
    state_id: '', district_id: '', city_id: '', ulb_id: '',
  });
  const [createProject, { isLoading }] = useCreateProjectMutation();

  // Cascading location lookups — each level loads once its parent is chosen.
  const { data: statesRes } = useGetStatesQuery();
  const { data: districtsRes } = useGetDistrictsQuery(form.state_id, { skip: !form.state_id });
  const { data: citiesRes } = useGetCitiesQuery(form.district_id, { skip: !form.district_id });
  const { data: ulbsRes } = useGetLocationsQuery(
    { level: 'ulbs', parentId: form.city_id },
    { skip: !form.city_id }
  );
  const states = statesRes?.data || [];
  const districts = districtsRes?.data || [];
  const cities = citiesRes?.data || [];
  const ulbs = ulbsRes?.data || [];

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // Picking a parent invalidates everything below it.
  const setState = (e) => setForm((f) => ({ ...f, state_id: e.target.value, district_id: '', city_id: '', ulb_id: '' }));
  const setDistrict = (e) => setForm((f) => ({ ...f, district_id: e.target.value, city_id: '', ulb_id: '' }));
  const setCity = (e) => setForm((f) => ({ ...f, city_id: e.target.value, ulb_id: '' }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Project name is required');
    try {
      const payload = {
        name: form.name,
        description: form.description,
        department: form.department || null,
        state_id: form.state_id || null,
        district_id: form.district_id || null,
        city_id: form.city_id || null,
        ulb_id: form.ulb_id || null,
      };
      const res = await createProject(payload).unwrap();
      toast.success(`Project "${res.data.name}" created (${res.data.code})`);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create project');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name *</label>
            <input value={form.name} onChange={set('name')} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Ward 12 Water & Sewer Mapping 2026" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
              <select value={form.state_id} onChange={setState} className={selectCls}>
                <option value="">Select state…</option>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">District</label>
              <select value={form.district_id} onChange={setDistrict} disabled={!form.state_id} className={selectCls}>
                <option value="">Select district…</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
              <select value={form.city_id} onChange={setCity} disabled={!form.district_id} className={selectCls}>
                <option value="">Select city…</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ULB</label>
              <select value={form.ulb_id} onChange={set('ulb_id')} disabled={!form.city_id} className={selectCls}>
                <option value="">Select ULB…</option>
                {ulbs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
            <select value={form.department} onChange={set('department')} className={selectCls}>
              <option value="">Select department…</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Scope / notes…" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={isLoading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold">
              {isLoading ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { data, isLoading, isError } = useGetProjectsQuery({});
  const [showCreate, setShowCreate] = useState(false);
  const projects = data?.data || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Projects</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Create a project, then upload shapefiles and assets into it.</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </header>

      <div className="p-6">
        {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading projects…</p>}
        {isError && <p className="text-red-600 dark:text-red-400">Failed to load projects. Is the backend running?</p>}

        {!isLoading && projects.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <FolderKanban className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">No projects yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Create your first project to start mapping assets.</p>
            <button onClick={() => setShowCreate(true)} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">+ New Project</button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <Link key={p.id} to={`/admin/projects/${p.id}`}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg dark:hover:border-blue-500 hover:border-blue-300 transition group">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition line-clamp-2">{p.name}</h3>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[p.status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">{p.code}</p>
              {p.client_name && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{p.client_name}</p>}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Layers className="w-4 h-4" /> {p.asset_feature_count} assets</span>
                {p.ward_id && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Ward {p.ward_id}</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
