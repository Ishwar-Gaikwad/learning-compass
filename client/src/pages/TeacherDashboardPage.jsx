import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { courseService } from '../services/course.service';
import { topicService } from '../services/topic.service';
import { materialService } from '../services/material.service';
import { assessmentService } from '../services/assessment.service';
import { CourseModal } from '../components/CourseModal';
import { TopicModal } from '../components/TopicModal';
import { MaterialUploadModal } from '../components/MaterialUploadModal';
import { AssessmentGeneratorModal } from '../components/AssessmentGeneratorModal';
import { AssessmentViewModal } from '../components/AssessmentViewModal';
import { StudentAttemptsModal } from '../components/StudentAttemptsModal';
import { ConfirmDialog } from '../components/common';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  Layers,
  CheckCircle2,
  FileText,
  AlertCircle,
  Loader2,
  ChevronRight,
  UploadCloud,
  Play,
  Sparkles,
  Eye,
  FileCode,
  Users,
  Copy,
  Image as ImageIcon
} from 'lucide-react';

export const TeacherDashboardPage = () => {
  const { user } = useAuth();
  const location = useLocation();

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [assessments, setAssessments] = useState([]);

  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Course Modal state
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);

  // Topic Modal state
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);

  // Material Upload Modal state
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  // Assessment Modals state
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAttemptsModalOpen, setIsAttemptsModalOpen] = useState(false);
  const [activeAssessment, setActiveAssessment] = useState(null);

  // Restore topic assessment-management page context from search params or location state
  useEffect(() => {
    if (!courses.length) return;

    const searchParams = new URLSearchParams(location.search);
    const targetCourseId = location.state?.courseId || searchParams.get('courseId');
    const targetTopicId = location.state?.topicId || searchParams.get('topicId');
    const targetAssessmentId = location.state?.assessmentId || searchParams.get('assessmentId');

    if (!targetCourseId && !targetTopicId && !targetAssessmentId) return;

    const restoreContext = async () => {
      try {
        let courseToSelect = null;
        let topicToSelect = null;
        let resolvedCId = targetCourseId;
        let resolvedTId = targetTopicId;

        // If courseId or topicId missing, attempt resolution from assessmentId
        if ((!resolvedCId || !resolvedTId) && targetAssessmentId) {
          const assDoc = await assessmentService.getAssessment(targetAssessmentId).catch(() => null);
          if (assDoc) {
            resolvedCId = resolvedCId || (assDoc.courseId?._id || assDoc.courseId);
            resolvedTId = resolvedTId || (assDoc.topicId?._id || assDoc.topicId);
          }
        }

        if (resolvedCId) {
          courseToSelect = courses.find((c) => c._id === resolvedCId);
        }

        if (courseToSelect && resolvedTId) {
          const fetchedTopics = await topicService.getTopics(courseToSelect._id);
          const sorted = [...fetchedTopics].sort((a, b) => (a.order || 0) - (b.order || 0));
          setTopics(sorted);
          topicToSelect = sorted.find((t) => t._id === resolvedTId);
          if (topicToSelect) {
            setSelectedCourse(courseToSelect);
            setSelectedTopic(topicToSelect);
            await fetchTopicContent(courseToSelect._id, topicToSelect._id);
          }
        }
      } catch (err) {
        console.error('[TeacherDashboardPage] Failed to restore topic assessment context:', err);
      }
    };

    restoreContext();
  }, [location.search, location.state, courses]);

  // 1. Fetch Teacher's Courses
  const fetchCourses = async () => {
    setIsLoadingCourses(true);
    setErrorMessage('');
    try {
      const data = await courseService.getCourses();
      setCourses(data);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load courses.');
    } finally {
      setIsLoadingCourses(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // 2. Fetch Topics when a course is selected
  const fetchTopics = async (courseId) => {
    setIsLoadingTopics(true);
    setErrorMessage('');
    try {
      const data = await topicService.getTopics(courseId);
      const sortedTopics = [...data].sort((a, b) => (a.order || 0) - (b.order || 0));
      setTopics(sortedTopics);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load topics for this course.');
    } finally {
      setIsLoadingTopics(false);
    }
  };

  // 3. Fetch Materials & Assessments when a topic is selected
  const fetchTopicContent = async (courseId, topicId) => {
    setIsLoadingMaterials(true);
    setIsLoadingAssessments(true);
    try {
      const matsData = await materialService.getMaterials(courseId, topicId);
      setMaterials(matsData);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load learning materials.');
    } finally {
      setIsLoadingMaterials(false);
    }

    try {
      const assData = await assessmentService.getAssessmentsByTopic(courseId, topicId);
      setAssessments(assData);
    } catch (err) {
      setAssessments([]);
    } finally {
      setIsLoadingAssessments(false);
    }
  };

  useEffect(() => {
    if (!selectedCourse || !selectedTopic) return;

    const hasProcessing = materials.some(m => m.processingStatus === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      try {
        const updatedMaterials = await materialService.getMaterials(selectedCourse._id, selectedTopic._id);
        setMaterials(updatedMaterials);
      } catch (err) {
        // Silently ignore background poll errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [materials, selectedCourse, selectedTopic]);

  const handleOpenCourse = (course) => {
    setSelectedCourse(course);
    setSelectedTopic(null);
    setMaterials([]);
    setAssessments([]);
    fetchTopics(course._id);
  };

  const handleSelectTopic = (topic) => {
    setSelectedTopic(topic);
    fetchTopicContent(selectedCourse._id, topic._id);
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setSelectedTopic(null);
    setTopics([]);
    setMaterials([]);
    setAssessments([]);
    fetchCourses();
  };

  const handleBackToTopics = () => {
    setSelectedTopic(null);
    setMaterials([]);
    setAssessments([]);
  };

  // Course Actions
  const handleSaveCourse = async (courseData) => {
    if (editingCourse) {
      const updated = await courseService.updateCourse(editingCourse._id, courseData);
      setCourses(courses.map(c => c._id === updated._id ? updated : c));
      if (selectedCourse && selectedCourse._id === updated._id) {
        setSelectedCourse(updated);
      }
    } else {
      const created = await courseService.createCourse(courseData);
      setCourses([created, ...courses]);
    }
  };

  const handleStatusChange = async (course, newStatus) => {
    try {
      const updated = await courseService.updateCourse(course._id, { status: newStatus });
      setCourses(courses.map(c => c._id === updated._id ? updated : c));
      if (selectedCourse && selectedCourse._id === updated._id) {
        setSelectedCourse(updated);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update course status.');
    }
  };

  // Topic Actions
  const handleSaveTopic = async (topicData) => {
    if (!selectedCourse) return;

    if (editingTopic) {
      const updated = await topicService.updateTopic(editingTopic._id, topicData);
      const newTopics = topics.map(t => t._id === updated._id ? updated : t)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setTopics(newTopics);
      if (selectedTopic && selectedTopic._id === updated._id) {
        setSelectedTopic(updated);
      }
    } else {
      const created = await topicService.createTopic(selectedCourse._id, topicData);
      const newTopics = [...topics, created].sort((a, b) => (a.order || 0) - (b.order || 0));
      setTopics(newTopics);
    }
  };

  const [topicToDelete, setTopicToDelete] = useState(null);
  const [isDeletingTopic, setIsDeletingTopic] = useState(false);

  const confirmDeleteTopic = async () => {
    if (!topicToDelete) return;
    setIsDeletingTopic(true);
    try {
      await topicService.deleteTopic(topicToDelete._id);
      setTopics(topics.filter((t) => t._id !== topicToDelete._id));
      if (selectedTopic && selectedTopic._id === topicToDelete._id) {
        setSelectedTopic(null);
      }
      setTopicToDelete(null);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete topic.');
    } finally {
      setIsDeletingTopic(false);
    }
  };

  const handleDeleteTopic = (topicId) => {
    const topic = topics.find((t) => t._id === topicId);
    if (topic) {
      setTopicToDelete(topic);
    }
  };

  // Material Upload & Ingestion Actions
  const handleUploadMaterial = async (file, title) => {
    if (!selectedCourse || !selectedTopic) return;

    const uploaded = await materialService.uploadMaterial(selectedCourse._id, selectedTopic._id, file, title);
    setMaterials(prev => [uploaded, ...prev]);

    try {
      await materialService.processMaterial(uploaded._id);
      fetchTopicContent(selectedCourse._id, selectedTopic._id);
    } catch (procErr) {
      fetchTopicContent(selectedCourse._id, selectedTopic._id);
    }
  };

  const handleProcessMaterial = async (materialId) => {
    try {
      setMaterials(materials.map(m => m._id === materialId ? { ...m, status: 'processing', processingStatus: 'processing' } : m));
      await materialService.processMaterial(materialId);
      fetchTopicContent(selectedCourse._id, selectedTopic._id);
    } catch (err) {
      setErrorMessage(err.message || 'Material processing failed.');
      fetchTopicContent(selectedCourse._id, selectedTopic._id);
    }
  };

  // Assessment Generation Actions
  const handleGenerateAssessment = async (config) => {
    if (!selectedCourse || !selectedTopic) return;

    const result = await assessmentService.generateAssessment(selectedCourse._id, selectedTopic._id, config);
    setAssessments(prev => [result.assessment, ...prev]);
    setActiveAssessment(result.assessment);
    setIsViewModalOpen(true);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'processed':
      case 'completed':
        return <span className="badge badge-success"><CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} color="#22C55E" /> Processed</span>;
      case 'processing':
      case 'chunking':
      case 'embedding':
        return <span className="badge badge-orange"><Loader2 size={12} className="spin" style={{ display: 'inline', marginRight: '4px' }} color="#FF8A00" /> Processing...</span>;
      case 'failed':
        return <span className="badge badge-error">Failed</span>;
      case 'uploaded':
      default:
        return <span className="badge badge-orange">Uploaded</span>;
    }
  };

  const getFileIcon = (mimeType = '') => {
    if (mimeType.includes('pdf')) return <FileText color="#FF8A00" size={24} />;
    if (mimeType.includes('image')) return <ImageIcon color="#22C55E" size={24} />;
    return <FileCode color="#FF8A00" size={24} />;
  };

  const hasProcessedMaterials = materials.some((m) => {
    const st = m.status || m.processingStatus;
    return st === 'processed' || st === 'completed';
  });

  return (
    <div style={{ padding: '30px 0 60px 0' }}>
      <div className="container">

        {/* Error Banner */}
        {errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid #EF4444',
            color: '#EF4444',
            marginBottom: '24px'
          }}>
            <AlertCircle size={18} color="#EF4444" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TOPIC DETAIL VIEW (MATERIALS & ASSESSMENTS) */}
        {selectedCourse && selectedTopic ? (
          <div>
            {/* Navigation Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button onClick={handleBackToTopics} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                  <ArrowLeft size={16} /> Back to Topics
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', fontSize: '0.9rem' }}>
                  <span>{selectedCourse.title}</span>
                  <ChevronRight size={16} />
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Topic #{selectedTopic.order}: {selectedTopic.title}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setIsMaterialModalOpen(true)} className="btn btn-secondary">
                  <UploadCloud size={16} /> Upload Material
                </button>
                <button onClick={() => setIsGeneratorModalOpen(true)} className="btn btn-primary">
                  <Sparkles size={16} /> Generate Assessment
                </button>
              </div>
            </div>

            {/* Topic Header Card */}
            <div className="card" style={{ padding: '28px', marginBottom: '36px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
              <span className="badge badge-orange" style={{ marginBottom: '12px' }}>Topic #{selectedTopic.order}</span>
              <h1 style={{ fontSize: '1.75rem', marginBottom: '8px', color: '#FFFFFF' }}>{selectedTopic.title}</h1>
              <p style={{ color: '#B3B3B3', margin: 0 }}>{selectedTopic.description || 'No detailed topic instructions.'}</p>
            </div>

            {/* 1. DIAGNOSTIC ASSESSMENTS SECTION */}
            <div style={{ marginBottom: '44px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                  <Sparkles color="#FF8A00" size={20} /> AI Diagnostic Assessments ({assessments.length})
                </h2>
              </div>

              {isLoadingAssessments ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#B3B3B3' }}>
                  <Loader2 size={28} className="spin" color="#FF8A00" style={{ margin: '0 auto 12px auto' }} />
                  <p>Loading topic assessments...</p>
                </div>
              ) : assessments.length === 0 ? (
                <div className="card" style={{ padding: '36px', textAlign: 'center', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
                  <Sparkles color="#FF8A00" size={36} style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '6px', color: '#FFFFFF' }}>No assessments generated yet</h3>
                  <p style={{ color: '#B3B3B3', fontSize: '0.9rem', marginBottom: '20px', maxWidth: '440px', margin: '0 auto 20px auto' }}>
                    Generate AI-powered diagnostic quizzes based on uploaded course material.
                  </p>
                  <button onClick={() => setIsGeneratorModalOpen(true)} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
                    <Sparkles size={14} /> Generate First Assessment
                  </button>
                </div>
              ) : (
                <div className="grid-3">
                  {assessments.map((ass) => (
                    <div key={ass._id} className="card" style={{ padding: '24px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span className="badge badge-success">AI Diagnostic Quiz</span>
                          <span className="badge badge-orange">{ass.difficulty || 'medium'}</span>
                        </div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#FFFFFF' }}>{ass.title}</h4>
                        <p style={{ color: '#B3B3B3', fontSize: '0.85rem', marginBottom: '14px' }}>
                          Total Questions: <strong style={{ color: '#FFFFFF' }}>{ass.questions ? ass.questions.length : ass.totalQuestions}</strong>
                        </p>

                        {ass.accessCode && (
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: '#1A1A1A',
                            border: '1px solid #2A2A2A',
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#808080', display: 'block' }}>Assessment Code</span>
                              <strong style={{ fontSize: '0.95rem', color: '#FF8A00', letterSpacing: '1px' }}>{ass.accessCode}</strong>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(ass.accessCode);
                                alert(`Access code ${ass.accessCode} copied to clipboard! Share this code with students.`);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Copy size={12} /> Copy
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setActiveAssessment(ass);
                            setIsViewModalOpen(true);
                          }}
                          className="btn btn-secondary"
                          style={{ width: '100%', fontSize: '0.85rem' }}
                        >
                          <Eye size={14} /> View Questions
                        </button>
                        <button
                          onClick={() => {
                            setActiveAssessment(ass);
                            setIsAttemptsModalOpen(true);
                          }}
                          className="btn btn-primary"
                          style={{ width: '100%', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Users size={14} /> Student Attempts & Reports
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. UPLOADED LEARNING MATERIALS SECTION */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                  <FileText color="#FF8A00" size={20} /> Uploaded Learning Materials ({materials.length})
                </h2>
              </div>

              {isLoadingMaterials ? (
                <div style={{ padding: '50px 0', textAlign: 'center', color: '#B3B3B3' }}>
                  <Loader2 size={32} className="spin" color="#FF8A00" style={{ margin: '0 auto 12px auto' }} />
                  <p>Loading topic materials...</p>
                </div>
              ) : materials.length === 0 ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
                  <UploadCloud color="#FF8A00" size={40} style={{ margin: '0 auto 14px auto' }} />
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px', color: '#FFFFFF' }}>No materials uploaded for this topic</h3>
                  <p style={{ color: '#B3B3B3', marginBottom: '20px', maxWidth: '440px', margin: '0 auto 20px auto', fontSize: '0.9rem' }}>
                    Upload PDFs, Word documents, PowerPoint presentations, or diagram images to automatically prepare learning materials and assessments.
                  </p>
                  <button onClick={() => setIsMaterialModalOpen(true)} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
                    <UploadCloud size={15} /> Upload First Material
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {materials.map((mat) => (
                    <div key={mat._id} className="card" style={{ padding: '20px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '10px',
                            background: '#1A1A1A',
                            border: '1px solid #2A2A2A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {getFileIcon(mat.mimeType)}
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#FFFFFF' }}>{mat.title || mat.originalFileName || mat.originalFilename}</h4>
                              {renderStatusBadge(mat.status || mat.processingStatus)}
                            </div>

                            <div style={{ display: 'flex', gap: '16px', color: '#B3B3B3', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                              <span>Filename: <strong style={{ color: '#FFFFFF' }}>{mat.originalFileName || mat.originalFilename}</strong></span>
                              <span>Size: <strong style={{ color: '#FFFFFF' }}>{formatFileSize(mat.fileSizeBytes || mat.fileSize)}</strong></span>
                              <span>MIME: <strong style={{ color: '#FFFFFF' }}>{mat.mimeType}</strong></span>
                              <span>Uploaded: <strong style={{ color: '#FFFFFF' }}>{new Date(mat.createdAt).toLocaleDateString()}</strong></span>
                            </div>

                            {mat.processingError && (
                              <div style={{ marginTop: '8px', color: '#EF4444', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #EF4444', padding: '6px 12px', borderRadius: '6px' }}>
                                Error: {typeof mat.processingError === 'object' ? mat.processingError.message : mat.processingError}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {((mat.status || mat.processingStatus) === 'uploaded' || (mat.status || mat.processingStatus) === 'failed') && (
                            <button
                              onClick={() => handleProcessMaterial(mat._id)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            >
                              <Play size={14} /> Process Material
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modals */}
            <MaterialUploadModal
              isOpen={isMaterialModalOpen}
              onClose={() => setIsMaterialModalOpen(false)}
              onUploadSuccess={handleUploadMaterial}
              topicTitle={selectedTopic.title}
            />

            <AssessmentGeneratorModal
              isOpen={isGeneratorModalOpen}
              onClose={() => setIsGeneratorModalOpen(false)}
              onGenerate={handleGenerateAssessment}
              topicTitle={selectedTopic.title}
              hasProcessedMaterials={hasProcessedMaterials}
            />

            <AssessmentViewModal
              isOpen={isViewModalOpen}
              onClose={() => setIsViewModalOpen(false)}
              assessment={activeAssessment}
            />

            <StudentAttemptsModal
              isOpen={isAttemptsModalOpen}
              onClose={() => setIsAttemptsModalOpen(false)}
              assessment={activeAssessment}
            />
          </div>

        ) : selectedCourse ? (
          /* COURSE CURRICULUM VIEW (TOPICS LIST) */
          <div>
            {/* Header / Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={handleBackToCourses} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                  <ArrowLeft size={16} /> Back to Courses
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', fontSize: '0.9rem' }}>
                  <span>Courses</span>
                  <ChevronRight size={16} />
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{selectedCourse.title}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setEditingCourse(selectedCourse); setIsCourseModalOpen(true); }} className="btn btn-secondary">
                  <Edit2 size={16} /> Edit Course
                </button>
                <button onClick={() => { setEditingTopic(null); setIsTopicModalOpen(true); }} className="btn btn-primary">
                  <Plus size={16} /> Add Topic
                </button>
              </div>
            </div>

            {/* Course Information Header Card */}
            <div className="card" style={{ padding: '28px', marginBottom: '36px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span className="badge badge-orange">{selectedCourse.code}</span>
                    <span className="badge badge-success">
                      {selectedCourse.status || 'published'}
                    </span>
                    <span style={{ color: '#B3B3B3', fontSize: '0.85rem' }}>{selectedCourse.subject} &bull; {selectedCourse.gradeLevel}</span>
                  </div>
                  <h1 style={{ fontSize: '1.8rem', marginBottom: '8px', color: '#FFFFFF' }}>{selectedCourse.title}</h1>
                  <p style={{ color: '#B3B3B3', maxWidth: '800px', margin: 0 }}>{selectedCourse.description || 'No description provided.'}</p>
                </div>
              </div>
            </div>

            {/* Topics Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                <Layers color="#FF8A00" size={20} /> Topics Curriculum ({topics.length})
              </h2>
            </div>

            {isLoadingTopics ? (
              <div style={{ padding: '50px 0', textAlign: 'center', color: '#B3B3B3' }}>
                <Loader2 size={32} className="spin" color="#FF8A00" style={{ margin: '0 auto 12px auto' }} />
                <p>Loading course topics...</p>
              </div>
            ) : topics.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
                <Layers color="#FF8A00" size={40} style={{ margin: '0 auto 14px auto' }} />
                <h3 style={{ fontSize: '1.15rem', marginBottom: '8px', color: '#FFFFFF' }}>No topics added yet</h3>
                <p style={{ color: '#B3B3B3', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px auto', fontSize: '0.9rem' }}>
                  Organize your course curriculum into topics for student diagnostics and learning paths.
                </p>
                <button onClick={() => { setEditingTopic(null); setIsTopicModalOpen(true); }} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
                  <Plus size={15} /> Add First Topic
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {topics.map((topic) => (
                  <div key={topic._id} className="card" style={{ padding: '20px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: '#1A1A1A',
                        border: '1px solid #2A2A2A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: '#FF8A00',
                        fontSize: '0.85rem'
                      }}>
                        #{topic.order || 1}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '4px', color: '#FFFFFF' }}>{topic.title}</h4>
                        <p style={{ color: '#B3B3B3', fontSize: '0.85rem', margin: 0 }}>
                          {topic.description || 'No detailed topic instructions.'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => handleSelectTopic(topic)} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                        Manage Topic <ChevronRight size={14} />
                      </button>
                      <button onClick={() => { setEditingTopic(topic); setIsTopicModalOpen(true); }} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDeleteTopic(topic._id)} className="btn btn-danger" style={{ padding: '6px 10px' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* COURSE OVERVIEW LIST */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '2rem', marginBottom: '4px', color: '#FFFFFF' }}>Teacher Dashboard</h1>
                <p style={{ color: '#B3B3B3', margin: 0 }}>
                  Welcome back, <strong style={{ color: '#FFFFFF' }}>{user?.name}</strong>. Manage your courses, topics, materials, and assessments.
                </p>
              </div>

              <button onClick={() => { setEditingCourse(null); setIsCourseModalOpen(true); }} className="btn btn-primary">
                <Plus size={16} /> Create New Course
              </button>
            </div>

            {isLoadingCourses ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#B3B3B3' }}>
                <Loader2 size={36} className="spin" color="#FF8A00" style={{ margin: '0 auto 16px auto' }} />
                <p>Loading your teaching courses...</p>
              </div>
            ) : courses.length === 0 ? (
              <div className="card" style={{ padding: '52px', textAlign: 'center', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
                <BookOpen color="#FF8A00" size={48} style={{ margin: '0 auto 18px auto' }} />
                <h3 style={{ fontSize: '1.3rem', marginBottom: '8px', color: '#FFFFFF' }}>No courses created yet</h3>
                <p style={{ color: '#B3B3B3', marginBottom: '24px', maxWidth: '460px', margin: '0 auto 24px auto', fontSize: '0.95rem' }}>
                  Create your first course to begin building topics, uploading learning materials, and diagnosing student mastery.
                </p>
                <button onClick={() => { setEditingCourse(null); setIsCourseModalOpen(true); }} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                  <Plus size={16} /> Create New Course
                </button>
              </div>
            ) : (
              <div className="grid-3">
                {courses.map((course) => (
                  <div key={course._id} className="card" style={{ padding: '24px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <span className="badge badge-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#FFFFFF', borderRadius: '6px', width: 'fit-content', flexShrink: 0 }}>
                          {course.code}
                        </span>
                        <div
                          style={{
                            background: '#1A1A1A',
                            border: '1px solid #2A2A2A',
                            color: '#FFFFFF',
                            borderRadius: '9999px',
                            padding: '7px 14px',
                            fontSize: '14px',
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: 'fit-content',
                            flexShrink: 0
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: (course.status || 'published') === 'published' ? '#22C55E' : (course.status === 'archived' ? '#EF4444' : '#F59E0B'),
                              flexShrink: 0
                            }}
                          />
                          <select
                            value={course.status || 'published'}
                            onChange={(e) => handleStatusChange(course, e.target.value)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#FFFFFF',
                              fontSize: '14px',
                              fontWeight: 500,
                              outline: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              margin: 0
                            }}
                          >
                            <option value="published" style={{ background: '#121212', color: '#FFFFFF' }}>Published</option>
                            <option value="draft" style={{ background: '#121212', color: '#FFFFFF' }}>Draft</option>
                            <option value="archived" style={{ background: '#121212', color: '#FFFFFF' }}>Archived</option>
                          </select>
                        </div>
                      </div>

                      <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '6px', color: '#FFFFFF' }}>{course.title}</h3>
                      <p style={{ color: '#B3B3B3', fontSize: '0.85rem', marginBottom: '18px', lineClamp: 2, webkitLineClamp: 2, display: '-webkit-box', webkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {course.description || 'No course description provided.'}
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid #2A2A2A', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={() => handleOpenCourse(course)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                        Open Course <ChevronRight size={14} />
                      </button>

                      <button onClick={() => { setEditingCourse(course); setIsCourseModalOpen(true); }} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        <CourseModal
          isOpen={isCourseModalOpen}
          onClose={() => setIsCourseModalOpen(false)}
          onSave={handleSaveCourse}
          initialCourse={editingCourse}
        />

        <TopicModal
          isOpen={isTopicModalOpen}
          onClose={() => setIsTopicModalOpen(false)}
          onSave={handleSaveTopic}
          initialTopic={editingTopic}
          defaultOrder={topics.length + 1}
        />

        <ConfirmDialog
          isOpen={Boolean(topicToDelete)}
          onClose={() => setTopicToDelete(null)}
          onConfirm={confirmDeleteTopic}
          title="Delete Topic"
          message={`Are you sure you want to delete topic "${topicToDelete?.title || ''}"?`}
          confirmText="Delete Topic"
          isConfirming={isDeletingTopic}
          variant="danger"
        />

      </div>
    </div>
  );
};
