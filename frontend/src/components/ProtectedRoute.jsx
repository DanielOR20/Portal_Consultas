import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function ProtectedRoute({ children, requiredRole = null }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F8] text-[#1F1416]">
        <div className="flex items-center gap-3 rounded-xl border border-[#F3D5DB] bg-white px-6 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#722F37]" />
          <span className="text-sm font-medium">Verificando sesión de colaborador...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.rol !== requiredRole) {
    return <Navigate to="/chat" replace />;
  }

  return children;
}
