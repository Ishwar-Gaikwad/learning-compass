import React, { useState, useEffect } from 'react';
import { Save, Plus, AlertCircle } from 'lucide-react';
import { Modal, Input, Button } from './common';

export const TopicModal = ({ isOpen, onClose, onSave, initialTopic = null, defaultOrder = 1 }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState(defaultOrder);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialTopic) {
      setTitle(initialTopic.title || '');
      setDescription(initialTopic.description || '');
      setOrder(initialTopic.order || defaultOrder);
    } else {
      setTitle('');
      setDescription('');
      setOrder(defaultOrder);
    }
    setErrorMessage('');
  }, [initialTopic, isOpen, defaultOrder]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Topic title is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        order: Number(order) || 1
      });
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save topic. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = initialTopic ? 'Edit Topic' : 'Add New Topic';

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
        icon={initialTopic ? Save : Plus}
      >
        {initialTopic ? 'Update Topic' : 'Add Topic'}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} footer={footer} size="sm">
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
          label="Topic Title"
          placeholder="e.g. Synthetic Division & Remainder Theorem"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
          required
        />

        <Input
          type="number"
          min="1"
          label="Sequence Order"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          disabled={isSubmitting}
          required
        />

        <Input
          type="textarea"
          label="Topic Description"
          rows={3}
          placeholder="Brief summary of concepts covered in this topic..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
        />
      </form>
    </Modal>
  );
};
