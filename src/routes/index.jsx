import { createBrowserRouter } from 'react-router-dom';
import Login from '../pages/Login';
import AdminDashboard from '../pages/AdminDashboard';
import ProjectsPage from '../pages/ProjectsPage';
import ProjectDetailPage from '../pages/ProjectDetailPage';
import AssetCatalogPage from '../pages/AssetCatalogPage';
import ManageUsersPage from '../pages/ManageUsersPage';
import LocationBoundariesPage from '../pages/LocationBoundariesPage';
import LocationManagerPage from '../pages/LocationManagerPage';
import AssetReportPage from '../pages/AssetReportPage';
import SurveyedDataPage from '../pages/SurveyedDataPage';
import GISTeamDashboard from '../pages/GISTeamDashboard';
import PropertyTaxPage from '../pages/PropertyTaxPage';
import Unauthorized from '../pages/Unauthorized';
import ProtectedRoute from '../components/ProtectedRoute';
import AdminLayout from '../layouts/AdminLayout';
import GISLayout from '../layouts/GISLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />,
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    // Public — no login. Citizens check their property tax here.
    path: '/tax',
    element: <PropertyTaxPage />,
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <AdminDashboard />,
      },
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
      {
        path: 'projects/:id',
        element: <ProjectDetailPage />,
      },
      {
        path: 'catalog',
        element: <AssetCatalogPage />,
      },
      {
        path: 'users',
        element: <ManageUsersPage />,
      },
      {
        path: 'boundaries',
        element: <LocationBoundariesPage />,
      },
      {
        path: 'locations',
        element: <LocationManagerPage />,
      },
      {
        path: 'reports',
        element: <AssetReportPage />,
      },
      {
        path: 'surveyed',
        element: <SurveyedDataPage />,
      },
    ],
  },
  {
    path: '/gis',
    element: (
      <ProtectedRoute allowedRoles={['GIS_EDITOR', 'GIS_ADMIN']}>
        <GISLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <GISTeamDashboard />,
      },
    ],
  },
  {
    path: '/unauthorized',
    element: <Unauthorized />,
  },
]);
