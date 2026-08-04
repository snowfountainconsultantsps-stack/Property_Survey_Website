import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  // If not authenticated, redirect to login
  // Also treat missing user (e.g. before hydration) as not logged in
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If user role is not in allowed roles, redirect to unauthorized page or login
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export default ProtectedRoute;
