import React from 'react';
import { AlertCircle } from 'lucide-react';

export const Input = ({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  helperText,
  required = false,
  disabled = false,
  autoFocus = false,
  rows,
  className = '',
  style = {},
  ariaDescribedBy,
  ...props
}) => {
  const inputId = id || name || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;
  const describedBy = [errorId, helperId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;

  const isTextarea = type === 'textarea';

  return (
    <div className={`form-group ${className}`} style={{ marginBottom: '20px', ...style }}>
      {label && (
        <label htmlFor={inputId} className="form-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
          {label}
          {required && <span style={{ color: '#ffffff', marginLeft: '4px' }}>*</span>}
        </label>
      )}

      {isTextarea ? (
        <textarea
          id={inputId}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={rows || 4}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="form-input"
          style={{
            background: '#000000',
            color: '#ffffff',
            borderColor: error ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
            resize: 'vertical'
          }}
          {...props}
        />
      ) : (
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="form-input"
          style={{
            background: '#000000',
            color: '#ffffff',
            borderColor: error ? '#ffffff' : 'rgba(255, 255, 255, 0.2)'
          }}
          {...props}
        />
      )}

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
        <span
          id={helperId}
          style={{
            display: 'block',
            marginTop: '6px',
            fontSize: '0.8rem',
            color: 'rgba(255, 255, 255, 0.6)'
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
};
