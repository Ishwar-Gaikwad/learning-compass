import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export const AuthLayout = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: '#000000'
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', marginBottom: '32px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '14px',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Compass color="#ffffff" size={28} />
        </div>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>
          Learning<span style={{ color: '#ffffff', opacity: 0.7 }}>Compass</span>
        </span>
      </Link>

      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '36px', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
        <Outlet />
      </div>
    </div>
  );
};
