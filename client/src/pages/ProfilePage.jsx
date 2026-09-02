import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, Mail, Shield, LogOut, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="container" style={{ padding: '40px 20px 60px' }}>
      <div
        className="card glass-card"
        style={{
          padding: '36px',
          borderRadius: '20px',
          maxWidth: '640px',
          margin: '0 auto',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <User color="#ffffff" size={32} />
          </div>
          <div>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>
              {user?.name || 'User Profile'}
            </h1>
            <span className="badge" style={{ textTransform: 'capitalize', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
              {user?.role || 'Authenticated Account'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Mail size={18} color="#ffffff" />
            <div>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.65)', display: 'block' }}>Email Address</span>
              <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>{user?.email || 'N/A'}</strong>
            </div>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Shield size={18} color="#ffffff" />
            <div>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.65)', display: 'block' }}>Account Role & Access Level</span>
              <strong style={{ fontSize: '0.95rem', textTransform: 'capitalize', color: '#ffffff' }}>
                {user?.role === 'teacher' ? 'Teacher / Educator Account' : 'Student Account'}
              </strong>
            </div>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <CheckCircle size={18} color="#ffffff" />
            <div>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.65)', display: 'block' }}>Account Status</span>
              <strong style={{ fontSize: '0.95rem', color: '#ffffff' }}>Active & Authenticated</strong>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <LogOut size={16} /> Sign Out of Account
        </button>
      </div>
    </div>
  );
};
