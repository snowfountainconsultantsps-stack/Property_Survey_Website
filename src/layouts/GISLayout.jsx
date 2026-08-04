import { Outlet } from 'react-router-dom';
import GISSidebar from './GISSidebar';

export default function GISLayout() {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <GISSidebar />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
