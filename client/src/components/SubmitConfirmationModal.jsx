import React from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { Modal, Button } from './common';

export const SubmitConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  answeredCount,
  totalQuestions
}) => {
  const unansweredCount = totalQuestions - answeredCount;

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={onConfirm}
        isLoading={isSubmitting}
        loadingText="Submitting..."
        icon={Send}
      >
        Confirm Submission
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Assessment?"
      footer={footer}
      size="sm"
    >
      <div style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.6 }}>
        {unansweredCount > 0 ? (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <AlertTriangle size={20} style={{ flexShrink: 0 }} color="#ffffff" />
            <span>
              <strong>Warning:</strong> You have <strong>{unansweredCount}</strong> unanswered{' '}
              {unansweredCount === 1 ? 'question' : 'questions'}. Unanswered questions will receive 0 points.
            </span>
          </div>
        ) : (
          <p style={{ marginBottom: '16px', color: '#ffffff' }}>
            You have answered all <strong>{totalQuestions}</strong> questions! Are you ready to submit your assessment?
          </p>
        )}

        <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.65)' }}>
          Once submitted, your answers will be locked and cannot be edited.
        </p>
      </div>
    </Modal>
  );
};
