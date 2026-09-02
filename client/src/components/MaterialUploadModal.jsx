import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, AlertCircle } from 'lucide-react';
import { Modal, Input, Button } from './common';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
];

export const MaterialUploadModal = ({ isOpen, onClose, onUploadSuccess, topicTitle }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setCustomTitle('');
      setErrorMessage('');
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [isOpen]);

  const validateFile = (file) => {
    if (!file) return false;

    // Check extension
    const filename = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => filename.endsWith(ext));
    const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

    if (!hasValidExtension && !hasValidMime) {
      setErrorMessage('Invalid file type. Supported formats: PDF, DOCX, PPTX, JPG, PNG, WEBP, GIF.');
      return false;
    }

    // Check 10MB file size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`File size exceeds the 10MB limit. Selected file is ${fileSizeMB} MB.`);
      return false;
    }

    return true;
  };

  const handleFileChange = (e) => {
    setErrorMessage('');
    const file = e.target.files[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setErrorMessage('');
    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select a course material file to upload.');
      return;
    }

    setErrorMessage('');
    setIsUploading(true);
    setUploadProgress(30);

    try {
      setUploadProgress(70);
      await onUploadSuccess(selectedFile, customTitle.trim() || selectedFile.name);
      setUploadProgress(100);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Material upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isUploading}>
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primary"
        onClick={handleSubmit}
        isLoading={isUploading}
        loadingText="Uploading..."
        disabled={!selectedFile}
        icon={UploadCloud}
      >
        Upload Material
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Learning Material"
      subtitle={`Topic: ${topicTitle}`}
      footer={footer}
      size="md"
    >
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
        {/* Drag & Drop File Select Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            border: '2px dashed rgba(255, 255, 255, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '32px 20px',
            textAlign: 'center',
            background: '#000000',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            marginBottom: '20px',
            transition: 'var(--transition)'
          }}
          onClick={() => !isUploading && document.getElementById('materialFileInput').click()}
        >
          <input
            id="materialFileInput"
            type="file"
            accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp,.gif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={isUploading}
          />

          {selectedFile ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <FileText color="#ffffff" size={40} />
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{selectedFile.name}</span>
              <span className="badge">{formatFileSize(selectedFile.size)}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <UploadCloud color="#ffffff" size={44} />
              <div>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>Click to upload</span> or drag and drop
              </div>
              <span style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.8rem' }}>
                Supported: PDF, DOCX, PPTX, Images (Max 10MB)
              </span>
            </div>
          )}
        </div>

        {selectedFile && (
          <Input
            label="Material Title"
            placeholder="e.g. Synthetic Division Lecture Slides"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            disabled={isUploading}
            required
          />
        )}

        {isUploading && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', marginBottom: '6px' }}>
              <span>Uploading & Processing...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="progress-bar-track" style={{ width: '100%', height: '6px' }}>
              <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};
