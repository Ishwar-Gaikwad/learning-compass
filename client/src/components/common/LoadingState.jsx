import React from 'react';
import { RefreshCw, BrainCircuit, Sparkles } from 'lucide-react';

export const LoadingState = ({
  message = 'Loading data...',
  subtitle = 'Please wait a moment while we process your request.',
  isAI = false,
  aiStateText,
  height = '50vh',
  type = 'spinner' // 'spinner' | 'skeleton' | 'card'
}) => {
  if (type === 'skeleton') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', padding: '20px 0' }}>
        {[1, 2, 3].map((n) => (
          <div key={n} className="card glass-card" style={{ padding: '24px', borderRadius: '16px', height: '160px', opacity: 0.6 }}>
            <div style={{ width: '60%', height: '18px', background: 'var(--border-color)', borderRadius: '4px', marginBottom: '14px' }} />
            <div style={{ width: '90%', height: '14px', background: 'var(--border-color)', borderRadius: '4px', marginBottom: '20px' }} />
            <div style={{ width: '40%', height: '32px', background: 'var(--border-color)', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: height,
        padding: '40px 20px',
        textAlign: 'center'
      }}
    >
      <div className="card glass-card" style={{ padding: '40px', borderRadius: '20px', maxWidth: '520px', width: '100%' }}>
        {isAI ? (
          <div style={{ marginBottom: '20px' }}>
            <BrainCircuit className="spin" size={48} color="var(--primary-light)" style={{ marginBottom: '12px' }} />
            {aiStateText && (
              <div className="badge badge-primary" style={{ padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} /> {aiStateText}
              </div>
            )}
          </div>
        ) : (
          <RefreshCw className="spin" size={40} color="var(--primary-color)" style={{ marginBottom: '20px' }} />
        )}

        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: 700 }}>{message}</h3>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>{subtitle}</p>
      </div>
    </div>
  );
};
