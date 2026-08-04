import { useAppSelector } from '../store/hooks';
import { LogOut, MapPin, FileText, TrendingUp, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import PolygonMap from '../components/PolygonMap';
import { useState, useRef } from 'react';

export default function GISTeamDashboard() {
  const { user } = useAppSelector((state) => state.auth);
  const refetchSurveysRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefetchSurveys = async () => {
    console.log('Refetch button clicked, refetchSurveys:', refetchSurveysRef.current);
    if (refetchSurveysRef.current && typeof refetchSurveysRef.current === 'function') {
      setIsRefreshing(true);
      const toastId = toast.loading('Refreshing survey data...');
      try {
        await refetchSurveysRef.current();
        toast.dismiss(toastId);
        toast.success('Survey data refreshed successfully!');
      } catch (err) {
        console.error('Error refetching surveys:', err);
        toast.dismiss(toastId);
        toast.error('Failed to refresh survey data');
      } finally {
        setIsRefreshing(false);
      }
    } else {
      toast.error('Refresh function not available yet');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">GIS Team Dashboard</h1>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-gray-700 dark:text-gray-300">Welcome, {user?.name || 'GIS Team Member'}</span>
            <button
              onClick={handleRefetchSurveys}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Map Section - Full Width */}
        <div className="mb-6" style={{ height: '600px' }}>
          <PolygonMap onRefetchReady={(fn) => {
            console.log('Received refetch function:', fn);
            refetchSurveysRef.current = fn;
          }} />
        </div>

        {/* Stats Cards
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs font-medium">Surveys in Progress</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">23</p>
              </div>
              <MapPin className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs font-medium">Completed Reports</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">89</p>
              </div>
              <FileText className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs font-medium">Accuracy Rate</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">98.5%</p>
              </div>
              <TrendingUp className="w-10 h-10 text-yellow-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs font-medium">Pending Tasks</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">12</p>
              </div>
              <MapPin className="w-10 h-10 text-red-500 opacity-20" />
            </div>
          </div>
        </div> */}

        {/* Features Section */}
        {/* <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition font-medium text-sm">
                Start New Survey
              </button>
              <button className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition font-medium text-sm">
                View My Assignments
              </button>
              <button className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition font-medium text-sm">
                Upload Findings
              </button>
              <button className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition font-medium text-sm">
                Generate Report
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Assignments</h2>
            <div className="space-y-3">
              <div className="pb-3 border-b">
                <p className="text-xs text-gray-600">Survey ID: PSV-001</p>
                <p className="text-gray-900 font-medium text-sm">Downtown Area Mapping</p>
                <p className="text-xs text-blue-600 mt-1">In Progress</p>
              </div>
              <div className="pb-3 border-b">
                <p className="text-xs text-gray-600">Survey ID: PSV-002</p>
                <p className="text-gray-900 font-medium text-sm">Residential Zone Assessment</p>
                <p className="text-xs text-blue-600 mt-1">Pending Review</p>
              </div>
              <div className="pb-3 border-b">
                <p className="text-xs text-gray-600">Survey ID: PSV-003</p>
                <p className="text-gray-900 font-medium text-sm">Commercial Property Analysis</p>
                <p className="text-xs text-gray-600 mt-1">Not Started</p>
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
