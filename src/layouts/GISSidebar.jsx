import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { useLogoutMutation } from '../store/api/authApi';
import { clearAuth } from '../store/slices/authSlice';
import { Map, Zap, FileUp, LogOut, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';

export default function GISSidebar() {
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
        { name: 'Dashboard', path: '/gis', icon: Map },
        { name: 'My Surveys', path: '/gis/surveys', icon: Map },
        { name: 'My Tasks', path: '/gis/tasks', icon: Zap },
        { name: 'Upload Findings', path: '/gis/upload', icon: FileUp },
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

            {/* Sidebar */}
            <aside
                className={`fixed lg:sticky lg:top-0 w-64 h-screen bg-blue-900 text-white transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                    } z-40`}
            >
                <div className="p-6 border-b border-blue-800">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Map className="w-8 h-8" />
                            <h1 className="text-xl font-bold">GIS Team</h1>
                        </div>
                        <ThemeToggle className="text-blue-100 hover:bg-blue-800" />
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-6 space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive
                                        ? 'bg-blue-700 text-white'
                                        : 'text-blue-100 hover:bg-blue-800'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout button */}
                <div className="absolute bottom-0 w-full p-6 border-t border-blue-800">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

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
