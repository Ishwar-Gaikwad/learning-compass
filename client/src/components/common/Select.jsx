import React from 'react';
import { AlertCircle } from 'lucide-react';

export const Select = ({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  style = {},
  children,
  ...props
}) => {
  const selectId = id || name || `select-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className={`form-group ${className}`} style={{ marginBottom: '20px', ...style }}>
      {label && (
        <label htmlFor={selectId} className="form-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
          {label}
          {required && <span style={{ color: '#ffffff', marginLeft: '4px' }}>*</span>}
        </label>
      )}

      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className="form-input"
        style={{
          backgroundColor: '#000000',
          color: '#ffffff',
          borderColor: error ? '#ffffff' : 'rgba(255, 255, 255, 0.2)'
        }}
        {...props}
      >
        {children ? (
          children
        ) : (
          options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: '#000000', color: '#ffffff' }}>
              {opt.label}
            </option>
          ))
        )}
      </select>

      {error && (
        <div
          id={errorId}
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '6px',
            fontSize: '0.8rem',
            color: '#ffffff'
          }}
        >
          <AlertCircle size={14} color="#ffffff" />
          <span>{error}</span>
        </div>
      )}

      {!error && helperText && (
        <span style={{ display: 'block', marginTop: '6px', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};
