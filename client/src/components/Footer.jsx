import React from 'react';
import { Compass } from 'lucide-react';

export const Footer = () => {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255, 255, 255, 0.15)',
      padding: '40px 0',
      marginTop: '80px',
      background: '#000000'
    }}>
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Compass color="#ffffff" size={20} />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff' }}>Learning Compass</span>
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.875rem', maxWidth: '600px' }}>
          AI-Powered Adaptive Learning & Diagnostic Assessment Platform. Personalized evaluation and targeted learning paths.
        </p>
        <p style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '0.75rem', marginTop: '8px' }}>
          &copy; {new Date().getFullYear()} Learning Compass. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
