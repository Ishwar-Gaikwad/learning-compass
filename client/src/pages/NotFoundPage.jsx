import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      textAlign: 'center',
      padding: '24px'
    }}>
      <Compass color="#ffffff" size={64} style={{ marginBottom: '24px', opacity: 0.8 }} />
      <h1 style={{ fontSize: '3rem', marginBottom: '12px', color: '#ffffff' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'rgba(255, 255, 255, 0.65)' }}>Page Not Found</h2>
      <p style={{ maxWidth: '460px', color: 'rgba(255, 255, 255, 0.45)', marginBottom: '32px' }}>
        The page or resource you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        <Home size={18} /> Return to Home
      </Link>
    </div>
  );
};
