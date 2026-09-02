import React from 'react';

export const Badge = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  style = {},
  ...props
}) => {
  const getBadgeClass = () => {
    switch (variant) {
      case 'secondary':
        return 'badge-secondary';
      case 'success':
      case 'emerald':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'danger':
      case 'error':
        return 'badge-error';
      case 'primary':
      default:
        return 'badge-primary';
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return { padding: '2px 8px', fontSize: '0.7rem' };
      case 'lg':
        return { padding: '6px 16px', fontSize: '0.85rem' };
      case 'md':
      default:
        return { padding: '4px 12px', fontSize: '0.75rem' };
    }
  };

  return (
    <span
      className={`badge ${getBadgeClass()} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        ...getSizeStyle(),
        ...style
      }}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} />}
      <span>{children}</span>
    </span>
  );
};
