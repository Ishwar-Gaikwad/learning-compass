import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const ErrorState = ({
  title = 'An Error Occurred',
  message = 'Unable to complete the operation. Please try again.',
  onRetry,
  retryText = 'Try Again',
  fullPage = false,
  className = '',
  style = {}
}) => {
  const content = (
    <div
      role="alert"
      className={`card glass-card ${className}`}
      style={{
        padding: '36px 24px',
        textAlign: 'center',
        borderRadius: '20px',
        background: '#09090b',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        maxWidth: '560px',
        margin: fullPage ? '0 auto' : '0',
        ...style
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}
      >
        <AlertCircle size={28} color="#ef4444" />
      </div>

      <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', color: '#ffffff', fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: '0 0 24px 0', color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.95rem', lineHeight: 1.6 }}>{message}</p>

      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={RefreshCw}>
          {retryText}
        </Button>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '20px' }}>
        {content}
      </div>
    );
  }

  return content;
};
