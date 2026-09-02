import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Fixed Toast Container */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '400px',
          width: 'calc(100% - 48px)',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';

          let border = '1px solid rgba(255, 159, 67, 0.4)';
          let iconColor = '#ff9f43';
          let shadow = '0 8px 24px rgba(255, 159, 67, 0.2)';

          if (isSuccess) {
            border = '1px solid rgba(34, 197, 94, 0.4)';
            iconColor = '#22c55e';
            shadow = '0 8px 24px rgba(34, 197, 94, 0.2)';
          } else if (isError) {
            border = '1px solid rgba(239, 68, 68, 0.4)';
            iconColor = '#ef4444';
            shadow = '0 8px 24px rgba(239, 68, 68, 0.2)';
          }

          return (
            <div
              key={t.id}
              className="glass-card"
              style={{
                pointerEvents: 'auto',
                padding: '14px 18px',
                borderRadius: '12px',
                background: '#151620',
                border,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: shadow
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 500 }}>
                {isSuccess && <CheckCircle2 size={18} color={iconColor} />}
                {isError && <AlertCircle size={18} color={iconColor} />}
                {!isSuccess && !isError && <Info size={18} color={iconColor} />}
                <span style={{ color: '#ffffff' }}>{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.65)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex'
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
