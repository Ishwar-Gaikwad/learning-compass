import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const AuthenticationLoadingScreen = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
    <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255, 138, 0, 0.2)', borderTopColor: '#FF8A00', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    <p style={{ color: 'var(--text-muted, #888888)', fontSize: '0.95rem', fontWeight: 500 }}>Validating authentication session...</p>
  </div>
);

export const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, loading, isLoading } = useAuth();
  const isAuthLoading = loading ?? isLoading;

  if (isAuthLoading) {
    return <AuthenticationLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    if (user?.role === 'teacher') {
      return <Navigate to="/teacher/dashboard" replace />;
    }
    if (user?.role === 'student') {
      return <Navigate to="/student/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
};

