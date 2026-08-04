import { useState } from 'react';
import { Boxes, Plus, X, Layers, Trash2, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';
import QuestionSchemaEditor from '../components/QuestionSchemaEditor';
import {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useCreateLayerMutation,
  useDeleteLayerMutation,
} from '../store/api/assetApi';

const GEOM_TYPES = ['POINT', 'LINESTRING', 'POLYGON'];

function CreateCategoryModal({ onClose }) {
  const [form, setForm] = useState({ code: '', name: '', description: '', color: '#2563eb' });
  const [createCategory, { isLoading }] = useCreateCategoryMutation();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return toast.error('Code and name are required');
    try {
      const res = await createCategory({ ...form, code: form.code.trim().toUpperCase() }).unwrap();
      toast.success(`Category "${res.data.name}" created`);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create category');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Asset Category</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input value={form.name} onChange={set('name')} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Street Lighting" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code *</label>
              <input value={form.code} onChange={set('code')}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="STREET_LIGHT" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Legend colour</label>
              <input type="color" value={form.color} onChange={set('color')}
                className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-1 cursor-pointer bg-white dark:bg-gray-700" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={isLoading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold">
              {isLoading ? 'Creating…' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateLayerModal({ categories, onClose }) {
  const [form, setForm] = useState({
    category_id: '', code: '', name: '', description: '',
    geometry_type: 'POINT', color: '#2563eb', surveyable: true,
  });
  const [createLayer, { isLoading }] = useCreateLayerMutation();

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.category_id) return toast.error('Choose a category');
    if (!form.code.trim() || !form.name.trim()) return toast.error('Code and name are required');
    try {
      const res = await createLayer({
        category_id: Number(form.category_id),
        code: form.code.trim().toUpperCase(),
        name: form.name,
        description: form.description,
        geometry_type: form.geometry_type,
        surveyable: form.surveyable,
        style:
          form.geometry_type === 'LINESTRING'
            ? { color: form.color, weight: 3 }
            : { color: form.color, fillColor: form.color, fillOpacity: 0.3, radius: 6 },
      }).unwrap();
      toast.success(`Layer "${res.data.name}" created`);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to create layer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Asset Layer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
            <select value={form.category_id} onChange={set('category_id')} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Select a category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input value={form.name} onChange={set('name')}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Streetlight Pole" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code *</label>
              <input value={form.code} onChange={set('code')}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="STREETLIGHT" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Geometry type *</label>
              <select value={form.geometry_type} onChange={set('geometry_type')}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                {GEOM_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Map colour</label>
              <input type="color" value={form.color} onChange={set('color')}
                className="w-full h-[42px] border border-gray-300 dark:border-gray-600 rounded-lg px-1 cursor-pointer bg-white dark:bg-gray-700" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2.5">
              <input type="checkbox" checked={form.surveyable} onChange={set('surveyable')}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" />
              Surveyors can add/correct in the field
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={isLoading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold">
              {isLoading ? 'Creating…' : 'Create Layer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssetCatalogPage() {
  const { data, isLoading, isError } = useGetCategoriesQuery();
  const [deleteLayer] = useDeleteLayerMutation();
  const [showCategory, setShowCategory] = useState(false);
  const [showLayer, setShowLayer] = useState(false);
  const [editingQuestionsFor, setEditingQuestionsFor] = useState(null);
  const categories = data?.data || [];

  const archiveLayer = async (id, name) => {
    if (!window.confirm(`Archive layer "${name}"? It will be hidden from the map and upload panel.`)) return;
    try {
      await deleteLayer(id).unwrap();
      toast.success('Layer archived');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to archive layer');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Boxes className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Asset Catalog</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Categories and layers available across every project's shapefile uploads.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCategory(true)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold px-4 py-2.5 rounded-lg transition">
              <Plus className="w-4 h-4" /> Category
            </button>
            <button onClick={() => setShowLayer(true)} disabled={!categories.length}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold px-4 py-2.5 rounded-lg transition">
              <Plus className="w-4 h-4" /> Layer
            </button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading catalog…</p>}
        {isError && <p className="text-red-600 dark:text-red-400">Failed to load catalog. Is the backend running?</p>}

        {!isLoading && categories.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <Boxes className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">No categories yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Create a category, then add layers under it.</p>
            <button onClick={() => setShowCategory(true)} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">+ New Category</button>
          </div>
        )}

        <div className="space-y-5">
          {categories.map((c) => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <h3 className="font-bold text-gray-900 dark:text-gray-100">{c.name}</h3>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{c.code}</span>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {(c.layers || []).length === 0 && (
                  <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">No layers in this category yet.</p>
                )}
                {(c.layers || []).map((l) => {
                  const questionCount = (l.attribute_schema || []).length;
                  return (
                    <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Layers className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{l.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {l.code} · {l.geometry_type} · {questionCount} question{questionCount === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setEditingQuestionsFor(l)}
                          className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900">
                          <ListChecks className="w-3.5 h-3.5" /> Questions
                        </button>
                        <button onClick={() => archiveLayer(l.id, l.name)}
                          className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900">
                          <Trash2 className="w-3.5 h-3.5" /> Archive
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCategory && <CreateCategoryModal onClose={() => setShowCategory(false)} />}
      {showLayer && <CreateLayerModal categories={categories} onClose={() => setShowLayer(false)} />}
      {editingQuestionsFor && (
        <QuestionSchemaEditor layer={editingQuestionsFor} onClose={() => setEditingQuestionsFor(null)} />
      )}
    </div>
  );
}
