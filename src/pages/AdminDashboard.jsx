import { useNavigate, Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { useLogoutMutation, useGetAllUsersQuery } from '../store/api/authApi';
import { useGetProjectsQuery, useGetAssetStatsQuery } from '../store/api/assetApi';
import { clearAuth } from '../store/slices/authSlice';
import {
  LogOut, BarChart3, Users, FolderKanban, Layers, AlertTriangle,
  CheckCircle2, MapPin, FileText, Boxes, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Relative "time ago" for the activity feed.
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff)) return '';
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 60) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Full class strings so Tailwind's purge keeps them.
const ICON_COLOR = {
  blue: 'text-blue-500',
  indigo: 'text-indigo-500',
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
};

function StatCard({ icon: Icon, label, value, sub, color = 'blue', loading }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-none dark:border dark:border-gray-700 p-6 hover:shadow-lg dark:hover:border-gray-600 transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{label}</p>
          {loading ? (
            <div className="h-10 w-20 mt-2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ) : (
            <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
          )}
          {sub && !loading && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
        </div>
        <Icon className={`w-12 h-12 ${ICON_COLOR[color] || ICON_COLOR.blue} opacity-20`} />
      </div>
    </div>
  );
}

const CONTROLS = [
  { to: '/admin/projects', label: 'Digital Asset Projects', icon: FolderKanban, primary: true },
  { to: '/admin/surveyed', label: 'Surveyed Data', icon: Layers },
  { to: '/admin/reports', label: 'Asset Reports', icon: FileText },
  { to: '/admin/catalog', label: 'Asset Catalog', icon: Boxes },
  { to: '/admin/users', label: 'Manage Users', icon: Users },
  { to: '/admin/boundaries', label: 'Boundaries & Locations', icon: MapPin },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [logout] = useLogoutMutation();

  // ── Live data ────────────────────────────────────────────────
  const usersQ = useGetAllUsersQuery();
  const projectsQ = useGetProjectsQuery({});
  const statsQ = useGetAssetStatsQuery();

  const users = usersQ.data?.data || [];
  const projects = projectsQ.data?.data || [];
  const layerStats = statsQ.data?.data || [];

  const activeUsers = users.filter((u) => u.is_active).length;
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;

  const totals = layerStats.reduce(
    (acc, s) => {
      acc.features += Number(s.feature_count || 0);
      acc.published += Number(s.published || 0);
      acc.flagged += Number(s.flagged || 0);
      return acc;
    },
    { features: 0, published: 0, flagged: 0 }
  );

  const anyError = usersQ.isError || projectsQ.isError || statsQ.isError;
  const anyLoading = usersQ.isLoading || projectsQ.isLoading || statsQ.isLoading;

  // Recent activity = newest projects + newest users, merged by time.
  const activity = [
    ...projects.map((p) => ({ when: p.createdAt, text: `Project “${p.name}” created`, tag: p.code })),
    ...users.map((u) => ({ when: u.createdAt, text: `${u.full_name || 'User'} registered`, tag: u.role })),
  ]
    .filter((a) => a.when)
    .sort((a, b) => new Date(b.when) - new Date(a.when))
    .slice(0, 6);

  const handleLogout = async () => {
    try {
      await logout().unwrap();
      dispatch(clearAuth());
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (err) {
      console.log(err);
      dispatch(clearAuth());
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-gray-700 dark:text-gray-300">Welcome, {user?.name || 'Admin'}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {(projectsQ.isError || usersQ.isError || statsQ.isError) && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" /> Some data could not be loaded. Is the backend running?
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard icon={Users} label="Total Users" color="blue"
            loading={usersQ.isLoading}
            value={users.length.toLocaleString('en-IN')}
            sub={`${activeUsers} active`} />
          <StatCard icon={FolderKanban} label="Projects" color="indigo"
            loading={projectsQ.isLoading}
            value={projects.length.toLocaleString('en-IN')}
            sub={`${activeProjects} active`} />
          <StatCard icon={Layers} label="Total Assets" color="emerald"
            loading={statsQ.isLoading}
            value={totals.features.toLocaleString('en-IN')}
            sub={`${totals.published.toLocaleString('en-IN')} published`} />
          <StatCard icon={AlertTriangle} label="Needs Review" color="amber"
            loading={statsQ.isLoading}
            value={totals.flagged.toLocaleString('en-IN')}
            sub="flagged assets" />
        </div>

        {/* Features Section */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-none dark:border dark:border-gray-700 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Admin Controls</h2>
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                anyError
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                  : 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
              }`}>
                {anyError ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {anyError ? 'Degraded' : anyLoading ? 'Loading…' : 'Operational'}
              </span>
            </div>
            <div className="space-y-3">
              {CONTROLS.map((c) => (
                <Link key={c.to} to={c.to}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg transition font-medium group ${
                    c.primary
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400'
                  }`}>
                  <span className="flex items-center gap-3"><c.icon className="w-5 h-5" /> {c.label}</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" />
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-none dark:border dark:border-gray-700 p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Recent Activity</h2>
            {anyLoading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity yet.</p>
            ) : (
              <ul className="space-y-4">
                {activity.map((a, i) => (
                  <li key={i} className="pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{a.text}</p>
                      {a.tag && <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{a.tag}</p>}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap mt-0.5">{timeAgo(a.when)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
