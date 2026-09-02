import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Compass,
  LogIn,
  UserPlus,
  LogOut,
  LayoutDashboard,
  BookOpen,
  Route as PathIcon,
  TrendingUp,
  User
} from 'lucide-react';

export const Navbar = () => {
  const { isAuthenticated, user, logout, loading, isLoading } = useAuth();
  const isAuthLoading = loading ?? isLoading;
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinkStyle = ({ isActive }) => ({
    padding: '8px 16px',
    fontSize: '0.85rem',
    background: isActive ? 'rgba(255, 138, 0, 0.10)' : 'transparent',
    color: isActive ? '#FF8A00' : '#B3B3B3',
    border: isActive ? '1px solid #FF8A00' : '1px solid #2A2A2A',
    borderRadius: '9999px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 600,
    letterSpacing: '0.015em',
    textDecoration: 'none',
    transition: 'all 0.2s ease-in-out'
  });

  return (
    <header className="glass-nav" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#0D0D0D', borderBottom: '1px solid #2A2A2A' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>
        <Link to={isAuthenticated ? (user?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard') : '/'} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: '#121212',
            border: '1px solid #2A2A2A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Compass color="#FF8A00" size={22} />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Learning<span style={{ color: '#FF8A00' }}>Compass</span>
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isAuthLoading ? (
            <span style={{ fontSize: '0.85rem', color: '#666666', fontStyle: 'italic', padding: '8px 12px' }}>
              Loading...
            </span>
          ) : isAuthenticated ? (
            <>
              {user?.role === 'teacher' && (
                <>
                  <NavLink to="/teacher/dashboard" style={getNavLinkStyle}>
                    <LayoutDashboard size={15} /> Dashboard
                  </NavLink>
                  <NavLink to="/teacher/profile" style={getNavLinkStyle}>
                    <User size={15} /> Profile
                  </NavLink>
                </>
              )}

              {user?.role === 'student' && (
                <>
                  <NavLink to="/student/dashboard" style={getNavLinkStyle}>
                    <LayoutDashboard size={15} /> Dashboard
                  </NavLink>
                  <NavLink to="/student/assessments" style={getNavLinkStyle}>
                    <BookOpen size={15} /> Assessments
                  </NavLink>
                  <NavLink to="/student/learning-paths" style={getNavLinkStyle}>
                    <PathIcon size={15} /> Learning Paths
                  </NavLink>
                  <NavLink to="/student/progress" style={getNavLinkStyle}>
                    <TrendingUp size={15} /> Progress
                  </NavLink>
                  <NavLink to="/student/profile" style={getNavLinkStyle}>
                    <User size={15} /> Profile
                  </NavLink>
                </>
              )}

              <span className="badge badge-orange" style={{ textTransform: 'capitalize', fontSize: '0.75rem', padding: '4px 12px' }}>
                {user?.role || 'User'}
              </span>

              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <LogOut size={15} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: '0.875rem' }}>
                <LogIn size={15} /> Sign In
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.875rem' }}>
                <UserPlus size={15} /> Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
