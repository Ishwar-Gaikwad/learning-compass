import React from 'react';
import { CheckCircle, Bookmark } from 'lucide-react';
import { Modal, Button } from './common';

export const AssessmentViewModal = ({ isOpen, onClose, assessment }) => {
  if (!assessment) return null;

  const questions = assessment.questions || [];

  const footer = (
    <Button variant="secondary" onClick={onClose}>
      Close Assessment View
    </Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={assessment.title}
      subtitle={`${questions.length} Questions • Difficulty: ${assessment.difficulty || 'medium'}`}
      footer={footer}
      size="xl"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {questions.map((q, idx) => (
          <div
            key={q._id || idx}
            style={{
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem' }}>
                Question #{idx + 1} ({q.questionType?.toUpperCase() || 'MCQ'})
              </span>
              <span className="badge">{q.difficulty || 'medium'}</span>
            </div>

            <h4 style={{ fontSize: '1.15rem', marginBottom: '16px', lineHeight: 1.4, color: '#ffffff' }}>
              {q.questionText}
            </h4>

            {/* MCQ Options */}
            {Array.isArray(q.options) && q.options.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {q.options.map((opt, oIdx) => {
                  const isCorrect = opt === q.correctAnswer;
                  return (
                    <div
                      key={oIdx}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background: isCorrect ? 'rgba(255, 255, 255, 0.12)' : '#000000',
                        border: `1px solid ${isCorrect ? '#ffffff' : 'rgba(255, 255, 255, 0.15)'}`,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.95rem'
                      }}
                    >
                      <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                      {isCorrect && <CheckCircle size={16} color="#ffffff" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Correct Answer Display if Short Answer / Code */}
            {(!q.options || q.options.length === 0) && (
              <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
                <span style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  EXPECTED ANSWER:
                </span>
                <span style={{ color: '#ffffff', fontSize: '0.95rem' }}>{q.correctAnswer}</span>
              </div>
            )}

            {/* Source References */}
            {Array.isArray(q.sourceReferences) && q.sourceReferences.length > 0 && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px dashed rgba(255, 255, 255, 0.25)',
                  marginTop: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#ffffff', fontWeight: 600, marginBottom: '6px' }}>
                  <Bookmark size={14} /> Course Material Reference:
                </div>
                {q.sourceReferences.map((ref, rIdx) => (
                  <div key={rIdx} style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.65)' }}>
                    Source Material: <span style={{ color: '#ffffff', fontWeight: 500 }}>{ref.fileName || 'Course Material'}</span>
                    {ref.pageNumber ? ` • Page ${ref.pageNumber}` : ''}
                    {typeof ref.chunkIndex === 'number' ? ` • Section ${ref.chunkIndex + 1}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};
