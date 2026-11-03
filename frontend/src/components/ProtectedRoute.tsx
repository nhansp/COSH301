import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserRole } from '../types';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[]; // when set, only these roles may enter
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#12091c]">
        <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect user to /login and preserve destination in redirect param
    const redirectUrl = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
    return <Navigate to={redirectUrl} replace />;
  }

  if (roles && (!user?.role || !roles.includes(user.role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
