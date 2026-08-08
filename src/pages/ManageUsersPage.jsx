import { useState } from 'react';
import { Users as UsersIcon, Plus, X, Trash2, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import AssignAreaModal from '../components/AssignAreaModal';
import {
  useGetAllUsersQuery,
  useCreateUserMutation,
  useDeleteUserMutation,
  useUpdateUserStatusMutation,
} from '../store/api/authApi';

const ROLES = ['SURVEYOR', 'SUPERVISOR', 'GIS_EDITOR', 'GIS_ADMIN', 'ADMIN'];

const ROLE_STYLES = {
  ADMIN: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400',
  SUPERVISOR: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
  SURVEYOR: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  GIS_EDITOR: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400',
  GIS_ADMIN: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400',
};

function AddUserModal({ onClose }) {
  const [form, setForm] = useState({ full_name: '', phone: '', password: '', role: 'SURVEYOR' });
  const [createUser, { isLoading }] = useCreateUserMutation();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error('Full name is required');
    if (!/^\d{10}$/.test(form.phone.trim())) return toast.error('Phone must be 10 digits');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      const res = await createUser(form).unwrap();
      toast.success(`User "${res.data?.full_name || form.full_name}" added`);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to add user');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
            <input value={form.full_name} onChange={set('full_name')} autoFocus
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Employee name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
              <input value={form.phone} onChange={set('phone')} maxLength={10}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="10-digit phone number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
              <input value={form.password} onChange={set('password')} type="password"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Minimum 6 characters" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role *</label>
            <select value={form.role} onChange={set('role')}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
              {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={isLoading}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold">
              {isLoading ? 'Adding…' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManageUsersPage() {
  const { data, isLoading, isError } = useGetAllUsersQuery();
  const [deleteUser] = useDeleteUserMutation();
  const [updateUserStatus] = useUpdateUserStatusMutation();
  const [showAdd, setShowAdd] = useState(false);
  const [assigning, setAssigning] = useState(null); // the surveyor being allocated
  const [search, setSearch] = useState('');

  const users = (Array.isArray(data) ? data : data?.users || data?.data?.users || data?.data || [])
    .filter((u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search)
    );

  const toggleActive = async (u) => {
    try {
      await updateUserStatus({ id: u.id, is_active: !u.is_active }).unwrap();
      toast.success(`${u.full_name} ${u.is_active ? 'deactivated' : 'activated'}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update status');
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.full_name}? This cannot be undone.`)) return;
    try {
      await deleteUser(u.id).unwrap();
      toast.success('User deleted');
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete user');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <UsersIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Manage Users</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add and manage surveyor, supervisor, GIS and admin accounts.</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg transition">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </header>

      <div className="p-6">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="w-full max-w-sm mb-4 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />

        {isLoading && <p className="text-gray-500 dark:text-gray-400">Loading users…</p>}
        {isError && <p className="text-red-600 dark:text-red-400">Failed to load users. Is the backend running?</p>}

        {!isLoading && users.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <UsersIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">No users found</p>
            <button onClick={() => setShowAdd(true)} className="text-blue-600 dark:text-blue-400 font-semibold hover:underline mt-2">+ Add User</button>
          </div>
        )}

        {users.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-3 py-3 font-medium">Phone</th>
                  <th className="text-left px-3 py-3 font-medium">Role</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Allocation</th>
                  <th className="text-right px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 text-gray-800 dark:text-gray-200 font-medium">{u.full_name}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 font-mono">{u.phone}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROLE_STYLES[u.role] || 'bg-gray-100 dark:bg-gray-700'}`}>
                        {u.role?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => toggleActive(u)}
                        className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                          u.is_active
                            ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}>
                        {u.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {/* Only surveyors are area-scoped; other roles see
                          everything, so allocation would be meaningless. */}
                      {u.role === 'SURVEYOR' ? (
                        <button onClick={() => setAssigning(u)}
                          className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900">
                          <MapPin className="w-3.5 h-3.5" /> Areas
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">All areas</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => remove(u)}
                        className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 ml-auto">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
      {assigning && <AssignAreaModal user={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}
