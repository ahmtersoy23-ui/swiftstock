import { Navigate } from 'react-router-dom';
import { useSSOStore } from '../stores/ssoStore';

export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: string[];
}) {
  const { user, wmsUser, accessToken } = useSSOStore();
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  if (requiredRole && wmsUser && !requiredRole.includes(wmsUser.role))
    return <Navigate to="/" replace />;
  return <>{children}</>;
}
