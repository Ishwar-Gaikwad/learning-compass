import React, { useState, useEffect } from 'react';
import { Save, Plus, AlertCircle } from 'lucide-react';
import { Modal, Input, Select, Button } from './common';

export const CourseModal = ({ isOpen, onClose, onSave, initialCourse = null }) => {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [gradeLevel, setGradeLevel] = useState('10th Grade');
  const [status, setStatus] = useState('published');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialCourse) {
      setTitle(initialCourse.title || '');
      setCode(initialCourse.code || '');
      setDescription(initialCourse.description || '');
      setSubject(initialCourse.subject || 'Mathematics');
      setGradeLevel(initialCourse.gradeLevel || '10th Grade');
      setStatus(initialCourse.status || 'published');
    } else {
      setTitle('');
      setCode(`MATH-${Math.floor(100 + Math.random() * 900)}`);
      setDescription('');
      setSubject('Mathematics');
      setGradeLevel('10th Grade');
      setStatus('published');
    }
    setErrorMessage('');
  }, [initialCourse, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Course title is required.');
      return;
    }
    if (!code.trim()) {
      setErrorMessage('Course code is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave({
        title: title.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        subject: subject.trim(),
        gradeLevel: gradeLevel.trim(),
        status
      });
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save course. Please check inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = initialCourse ? 'Edit Course Details' : 'Create New Course';

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primary"
        onClick={handleSubmit}
        isLoading={isSubmitting}
        loadingText="Saving..."
        icon={initialCourse ? Save : Plus}
      >
        {initialCourse ? 'Update Course' : 'Create Course'}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} footer={footer} size="md">
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
          label="Course Title"
          placeholder="e.g. Advanced Polynomial Algebra"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
          required
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="Course Code"
            placeholder="e.g. MATH-101"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={isSubmitting}
            options={[
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
              { value: 'archived', label: 'Archived' }
            ]}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="Subject"
            placeholder="Mathematics"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSubmitting}
          />

          <Input
            label="Grade Level"
            placeholder="10th Grade"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <Input
          type="textarea"
          label="Course Description"
          rows={3}
          placeholder="Brief course overview and curriculum scope..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};
