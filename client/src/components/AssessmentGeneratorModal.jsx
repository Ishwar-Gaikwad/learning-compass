import React, { useState, useEffect } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Modal, Input, Select, Button } from './common';

export const AssessmentGeneratorModal = ({ isOpen, onClose, onGenerate, topicTitle, hasProcessedMaterials }) => {
  const [title, setTitle] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(3);
  const [difficulty, setDifficulty] = useState('medium');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(`${topicTitle || 'Topic'} Diagnostic Quiz`);
      setTotalQuestions(3);
      setDifficulty('medium');
      setAdditionalInstructions('');
      setErrorMessage('');
      setIsGenerating(false);
    }
  }, [isOpen, topicTitle]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasProcessedMaterials) {
      setErrorMessage('Cannot generate assessment: No processed learning material found for this topic. Please upload and process course material first.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Assessment title is required.');
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);

    try {
      await onGenerate({
        title: title.trim(),
        totalQuestions: Number(totalQuestions),
        difficulty,
        additionalInstructions: additionalInstructions.trim()
      });
      onClose();
    } catch (err) {
      if (err.message?.toLowerCase().includes('no processed') || err.code === 'NO_PROCESSED_MATERIAL') {
        setErrorMessage('No processed learning materials found for this topic. Please upload and process course materials first.');
      } else {
        setErrorMessage(err.message || 'Failed to generate diagnostic assessment. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isGenerating}>
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primary"
        onClick={handleSubmit}
        isLoading={isGenerating}
        loadingText="Generating Assessment..."
        disabled={!hasProcessedMaterials}
        icon={Sparkles}
      >
        Generate Assessment
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Diagnostic Assessment"
      subtitle={`Topic: ${topicTitle}`}
      footer={footer}
      size="md"
    >
      {!hasProcessedMaterials && !errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#ffffff',
            fontSize: '0.875rem',
            marginBottom: '20px'
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} color="#ffffff" />
          <span>This topic does not have processed learning materials. Upload and process a material document before generating assessments.</span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            background: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#ffffff',
            fontSize: '0.875rem',
            marginBottom: '20px'
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} color="#ffffff" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Input
          label="Assessment Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isGenerating}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Select
            label="Total Questions"
            value={totalQuestions}
            onChange={(e) => setTotalQuestions(e.target.value)}
            disabled={isGenerating}
            options={[
              { value: 1, label: '1 Question' },
              { value: 2, label: '2 Questions' },
              { value: 3, label: '3 Questions' },
              { value: 5, label: '5 Questions' },
              { value: 10, label: '10 Questions' }
            ]}
          />

          <Select
            label="Difficulty Level"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            disabled={isGenerating}
            options={[
              { value: 'medium', label: 'Medium' },
              { value: 'easy', label: 'Easy' },
              { value: 'hard', label: 'Hard' },
              { value: 'mixed', label: 'Mixed' }
            ]}
          />
        </div>

        <Input
          type="textarea"
          label="Additional Teacher Instructions (Optional)"
          rows={3}
          placeholder="e.g. Emphasize linear binomial divisor setups and Remainder Theorem calculations..."
          value={additionalInstructions}
          onChange={(e) => setAdditionalInstructions(e.target.value)}
          disabled={isGenerating}
        />
      </form>
    </Modal>
  );
};
