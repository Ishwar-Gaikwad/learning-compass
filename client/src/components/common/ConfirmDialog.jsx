import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isConfirming = false,
  variant = 'danger'
}) => {
  const isDanger = variant === 'danger';

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
        {cancelText}
      </Button>
      <button
        className={isDanger ? 'btn btn-danger' : 'btn btn-primary'}
        onClick={onConfirm}
        disabled={isConfirming}
        style={{ padding: '10px 22px', fontSize: '0.9rem' }}
      >
        {isConfirming ? 'Processing...' : confirmText}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} size="sm" ariaLabel={title}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: isDanger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 159, 67, 0.16)',
            border: isDanger ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 159, 67, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <AlertTriangle size={24} color={isDanger ? '#ef4444' : '#ff9f43'} />
        </div>
        <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.95rem', lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
    </Modal>
  );
};
