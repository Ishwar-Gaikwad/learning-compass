import React from 'react';

export const Card = ({
  title,
  subtitle,
  headerExtra,
  footer,
  children,
  variant = 'glass',
  className = '',
  style = {},
  onClick,
  ...props
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'solid':
        return { background: 'var(--bg-dark)', border: '1px solid var(--border-color)' };
      case 'interactive':
        return { cursor: 'pointer' };
      case 'glass':
      default:
        return {};
    }
  };

  return (
    <div
      className={`card glass-card ${className}`}
      onClick={onClick}
      style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        ...getVariantStyle(),
        ...style
      }}
      {...props}
    >
      {(title || subtitle || headerExtra) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px'
          }}
        >
          <div>
            {title && <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.4 }}>{title}</h3>}
            {subtitle && (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
            )}
          </div>
          {headerExtra && <div>{headerExtra}</div>}
        </div>
      )}

      <div>{children}</div>

      {footer && <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>{footer}</div>}
    </div>
  );
};
