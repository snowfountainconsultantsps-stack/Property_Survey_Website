import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { useLogoutMutation } from '../store/api/authApi';
import { clearAuth } from '../store/slices/authSlice';
import { BarChart3, Users, Settings, LogOut, Menu, X, FolderKanban, Boxes, Map, Building2, Filter, ClipboardList, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';

// Labels are present in the DOM at all times (so screen readers and the
// keyboard tab order still see them) but collapse to zero width on desktop
// until the rail is hovered.
const LABEL = 'whitespace-nowrap overflow-hidden transition-all duration-200 lg:w-0 lg:opacity-0 lg:group-hover:w-auto lg:group-hover:opacity-100';

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [logout] = useLogoutMutation();
  const [isOpen, setIsOpen] = useState(false);

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

  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: BarChart3, exact: true },
    { name: 'Projects', path: '/admin/projects', icon: FolderKanban },
    { name: 'Asset Catalog', path: '/admin/catalog', icon: Boxes },
    { name: 'Locations', path: '/admin/locations', icon: Building2 },
    { name: 'Boundaries', path: '/admin/boundaries', icon: Map },
    { name: 'Surveyed Data', path: '/admin/surveyed', icon: ClipboardList },
    { name: 'Asset Reports', path: '/admin/reports', icon: Filter },
    { name: 'Performance', path: '/admin/performance', icon: Gauge },
    { name: 'Manage Users', path: '/admin/users', icon: Users },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded-lg"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar. Declared before the spacer so Tailwind's `peer` variant can
          drive the spacer's width from this element's hover state — the aside
          is `fixed`, so DOM order doesn't affect where either one renders. */}
      <aside
        className={`group peer fixed top-0 left-0 h-screen bg-blue-900 text-white z-40 flex flex-col
          w-64 lg:w-20 lg:hover:w-64
          transition-[width,transform] duration-200 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand */}
        <div className="h-[73px] flex-shrink-0 flex items-center gap-3 px-6 border-b border-blue-800 lg:px-0 lg:group-hover:px-6 transition-all duration-200">
          <div className="flex items-center gap-3 flex-1 min-w-0 lg:justify-center lg:group-hover:justify-start">
            <BarChart3 className="w-8 h-8 flex-shrink-0" />
            <h1 className={`text-xl font-bold ${LABEL}`}>Admin Panel</h1>
          </div>
          <div className={LABEL}>
            <ThemeToggle className="text-blue-100 hover:bg-blue-800" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                // Native tooltip so collapsed icons are still identifiable.
                title={item.name}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors lg:justify-center lg:group-hover:justify-start ${
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-100 hover:bg-blue-800'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className={LABEL}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="flex-shrink-0 p-4 border-t border-blue-800">
          <button
            onClick={handleLogout}
            title="Logout"
            className="w-full flex items-center gap-3 px-3 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors lg:justify-center lg:group-hover:justify-start"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={LABEL}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Occupies the sidebar's slot in the flex row and grows with it, so the
          page content slides right as the rail expands instead of being
          covered by it. Widths must stay in step with the aside above. */}
      <div
        aria-hidden="true"
        className="hidden lg:block flex-shrink-0 w-20 peer-hover:w-64 transition-[width] duration-200 ease-out"
      />

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
