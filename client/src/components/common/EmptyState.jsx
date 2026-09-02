import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No items found',
  description = 'There are currently no items to display.',
  actionLabel,
  onAction,
  actionIcon,
  className = '',
  style = {}
}) => {
  return (
    <div
      className={`card glass-card ${className}`}
      style={{
        padding: '50px 24px',
        textAlign: 'center',
        borderRadius: '20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}
      >
        <Icon size={32} color="var(--text-muted)" />
      </div>

      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: 700 }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 0 24px 0', fontSize: '0.95rem', lineHeight: 1.5 }}>
        {description}
      </p>

      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} icon={actionIcon}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
