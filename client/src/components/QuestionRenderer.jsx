import React from 'react';
import { HelpCircle, Code, AlignLeft, CheckCircle2 } from 'lucide-react';

export const QuestionRenderer = ({
  question,
  questionNumber,
  totalQuestions,
  currentValue = '',
  onChange,
  disabled = false
}) => {
  if (!question) return null;

  const { questionText, questionType, options = [], difficulty } = question;

  const getDifficultyBadge = (level) => {
    return <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>{level || 'Medium'}</span>;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'mcq':
        return <HelpCircle size={16} color="#FF8A00" />;
      case 'code':
        return <Code size={16} color="#FF8A00" />;
      case 'short_answer':
      default:
        return <AlignLeft size={16} color="#FF8A00" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'mcq':
        return 'Multiple Choice';
      case 'code':
        return 'Code Input';
      case 'short_answer':
      default:
        return 'Short Answer';
    }
  };

  return (
    <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
      {/* Question Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: '#FF8A00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: '#0D0D0D',
            fontSize: '0.85rem'
          }}>
            {questionNumber}
          </div>
          <span style={{ color: '#B3B3B3', fontSize: '0.85rem', fontWeight: 500 }}>
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: '#1A1A1A',
            border: '1px solid #2A2A2A',
            fontSize: '0.8rem',
            color: '#B3B3B3'
          }}>
            {getTypeIcon(questionType)}
            {getTypeLabel(questionType)}
          </span>
          {getDifficultyBadge(difficulty)}
        </div>
      </div>

      {/* Question Text */}
      <div style={{
        fontSize: '1.1rem',
        fontWeight: 600,
        lineHeight: 1.5,
        color: '#FFFFFF',
        marginBottom: '20px'
      }}>
        {questionText}
      </div>

      {/* Input renderer based on questionType */}
      {questionType === 'mcq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {options.map((option, index) => {
            const isSelected = currentValue === option;

            return (
              <label
                key={index}
                onClick={() => !disabled && onChange(option)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 18px',
                  borderRadius: '8px',
                  background: isSelected ? 'rgba(255, 138, 0, 0.10)' : '#121212',
                  border: isSelected ? '1px solid #FF8A00' : '1px solid #2A2A2A',
                  cursor: disabled ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: disabled && !isSelected ? 0.6 : 1
                }}
              >
                <input
                  type="radio"
                  name={`question-${questionNumber}`}
                  value={option}
                  checked={isSelected}
                  onChange={() => !disabled && onChange(option)}
                  disabled={disabled}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: '#FF8A00',
                    cursor: disabled ? 'default' : 'pointer'
                  }}
                />
                <span style={{
                  fontSize: '0.95rem',
                  color: isSelected ? '#FFFFFF' : '#B3B3B3',
                  fontWeight: isSelected ? 600 : 400,
                  flexGrow: 1
                }}>
                  {option}
                </span>
                {isSelected && (
                  <CheckCircle2 size={16} color="#FF8A00" />
                )}
              </label>
            );
          })}
        </div>
      )}

      {questionType === 'short_answer' && (
        <div>
          <textarea
            className="form-input"
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={disabled ? 'No answer provided' : 'Type your detailed answer here...'}
            rows={4}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '8px',
              resize: 'vertical',
              fontSize: '0.95rem',
              lineHeight: 1.5,
              background: '#121212',
              color: '#FFFFFF',
              border: '1px solid #2A2A2A',
              opacity: disabled ? 0.7 : 1
            }}
          />
        </div>
      )}

      {questionType === 'code' && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            background: '#1A1A1A',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            border: '1px solid #2A2A2A',
            borderBottom: 'none'
          }}>
            <span style={{ fontSize: '0.75rem', color: '#FF8A00', fontFamily: 'monospace' }}>
              Code Response Editor
            </span>
          </div>
          <textarea
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={disabled ? 'No code provided' : '// Type your code implementation here...\nfunction solution() {\n  \n}'}
            rows={8}
            style={{
              width: '100%',
              padding: '14px',
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px',
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              background: '#0D0D0D',
              color: '#FFFFFF',
              fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              border: '1px solid #2A2A2A',
              outline: 'none',
              resize: 'vertical',
              opacity: disabled ? 0.7 : 1
            }}
          />
        </div>
      )}
    </div>
  );
};
