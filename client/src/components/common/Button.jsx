import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  isLoading = false,
  loadingText,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  onClick,
  className = '',
  style = {},
  ariaLabel,
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'secondary':
        return 'btn-secondary';
      case 'danger':
      case 'error':
        return 'btn-danger';
      case 'ghost':
        return 'btn-ghost';
      case 'primary':
      default:
        return 'btn-primary';
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return { padding: '6px 14px', fontSize: '0.85rem' };
      case 'lg':
        return { padding: '14px 28px', fontSize: '1.05rem' };
      case 'md':
      default:
        return { padding: '10px 20px', fontSize: '0.95rem' };
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      className={`btn ${getVariantClass()} ${className}`}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-busy={isLoading}
      style={{
        ...getSizeStyle(),
        opacity: isDisabled ? 0.65 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        ...style
      }}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="spin" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
        </>
      )}
    </button>
  );
};
