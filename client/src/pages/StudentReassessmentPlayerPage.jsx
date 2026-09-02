import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { attemptService } from '../services/attempt.service';
import { reassessmentService } from '../services/reassessment.service';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { SubmitConfirmationModal } from '../components/SubmitConfirmationModal';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  Layers,
  HelpCircle,
  BrainCircuit,
  Target,
  Sparkles
} from 'lucide-react';

export const StudentReassessmentPlayerPage = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  // Core Attempt & Questions State
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responsesMap, setResponsesMap] = useState({});
  const [savingStatus, setSavingStatus] = useState({});

  // Asynchronous Processing & UI States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Processing stage state: 'idle' | 'submitted' | 'evaluating' | 'generating_diagnostic' | 'comparison_ready' | 'failed'
  const [processingStage, setProcessingStage] = useState('idle');
  const [processingError, setProcessingError] = useState(null);

  // Initialize or restore reassessment attempt session
  const initSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await attemptService.startAttempt(assessmentId);
      const attemptDoc = data.attempt;

      if (!attemptDoc || !attemptDoc.assessmentId) {
        throw new Error('Invalid reassessment session data received from server.');
      }

      setAttempt(attemptDoc);

      const assessmentObj = attemptDoc.assessmentId;
      const loadedQuestions = assessmentObj.questions || [];
      setQuestions(loadedQuestions);

      // Fetch saved responses for this active attempt
      const currentData = await attemptService.getCurrentAttempt(assessmentId);
      const savedResponses = currentData.responses || [];

      const initialResponses = {};
      const initialStatus = {};
      savedResponses.forEach((res) => {
        if (res.questionId && res.studentAnswer) {
          initialResponses[res.questionId] = res.studentAnswer;
          initialStatus[res.questionId] = 'saved';
        }
      });

      setResponsesMap(initialResponses);
      setSavingStatus(initialStatus);

      // If already submitted, check if we need to process comparison or navigate
      if (attemptDoc.status === 'submitted' || attemptDoc.status === 'evaluated') {
        handleProcessSubmission(attemptDoc._id);
      }
    } catch (err) {
      console.error('[StudentReassessmentPlayerPage] Initialization failed:', err);
      setError(err.message || 'Unable to load reassessment session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Execute backend evaluation, new diagnostic generation, and comparison processing
  const handleProcessSubmission = async (attemptIdToProcess) => {
    setProcessingStage('submitted');
    setProcessingError(null);

    try {
      setProcessingStage('evaluating');
      await new Promise((r) => setTimeout(r, 600));

      setProcessingStage('generating_diagnostic');
      const processRes = await reassessmentService.processReassessment(attemptIdToProcess);

      if (processRes && processRes.comparison) {
        setProcessingStage('comparison_ready');
        navigate(`/student/reassessments/attempt/${attemptIdToProcess}/comparison`);
      } else {
        throw new Error('Diagnostic comparison response payload was empty.');
      }
    } catch (err) {
      console.error('[StudentReassessmentPlayerPage] Processing failed:', err);
      setProcessingError(err.message || 'Processing reassessment submission failed.');
      setProcessingStage('failed');
    }
  };

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIdx];

  const answeredQuestionIds = useMemo(() => {
    return Object.keys(responsesMap).filter((qId) => {
      const val = responsesMap[qId];
      return typeof val === 'string' && val.trim().length > 0;
    });
  }, [responsesMap]);

  const answeredCount = answeredQuestionIds.length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const isReadOnly = attempt?.status === 'submitted' || attempt?.status === 'evaluated' || processingStage !== 'idle';

  const saveTimersRef = useRef({});

  // Auto-save response to backend API
  const persistResponse = async (questionId, answer) => {
    if (!attempt || isReadOnly) return;

    setSavingStatus((prev) => ({ ...prev, [questionId]: 'saving' }));

    try {
      await attemptService.saveResponse(attempt._id, questionId, answer);
      setSavingStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
    } catch (err) {
      console.error(`[StudentReassessmentPlayerPage] Save response failed for Q:${questionId}:`, err);
      setSavingStatus((prev) => ({ ...prev, [questionId]: 'error' }));
    }
  };

  const handleAnswerChange = (newAnswer) => {
    if (!currentQuestion || isReadOnly) return;

    const qId = currentQuestion._id;
    // Update local state immediately for 0-latency typing
    setResponsesMap((prev) => ({ ...prev, [qId]: newAnswer }));

    if (saveTimersRef.current[qId]) {
      clearTimeout(saveTimersRef.current[qId]);
      delete saveTimersRef.current[qId];
    }

    if (newAnswer && newAnswer.trim().length > 0) {
      setSavingStatus((prev) => ({ ...prev, [qId]: 'saving' }));

      // Schedule 800ms debounced save
      saveTimersRef.current[qId] = setTimeout(() => {
        persistResponse(qId, newAnswer);
        delete saveTimersRef.current[qId];
      }, 800);
    } else {
      setSavingStatus((prev) => ({ ...prev, [qId]: 'idle' }));
    }
  };

  const flushPendingSave = (qId) => {
    if (qId && saveTimersRef.current[qId]) {
      clearTimeout(saveTimersRef.current[qId]);
      delete saveTimersRef.current[qId];
      const answer = responsesMap[qId];
      if (answer && answer.trim().length > 0) {
        persistResponse(qId, answer);
      }
    }
  };

  const handleQuestionNavigate = (newIdx) => {
    if (currentQuestion?._id) {
      flushPendingSave(currentQuestion._id);
    }
    setCurrentIdx(newIdx);
  };

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timerId) => {
        if (timerId) clearTimeout(timerId);
      });
    };
  }, []);

  const handleRetrySave = (qId) => {
    const answer = responsesMap[qId];
    if (qId && answer) {
      persistResponse(qId, answer);
    }
  };

  // Final submission handler
  const handleConfirmSubmit = async () => {
    if (!attempt || isReadOnly || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const submitRes = await attemptService.submitAttempt(attempt._id);
      setAttempt(submitRes.attempt);
      setIsSubmitModalOpen(false);
      await handleProcessSubmission(attempt._id);
    } catch (err) {
      console.error('[StudentReassessmentPlayerPage] Submission failed:', err);
      alert(err.message || 'Failed to submit reassessment attempt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="card glass-card" style={{ padding: '40px', borderRadius: '20px', maxWidth: '500px', margin: '0 auto', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <RefreshCw className="spin" size={40} color="#ffffff" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#ffffff' }}>Loading Reassessment Session...</h3>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)' }}>Retrieving targeted questions and restoring your session.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '60px 20px' }}>
        <div className="card glass-card" style={{ padding: '40px', borderRadius: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
          <AlertCircle size={48} color="#ffffff" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.4rem', color: '#ffffff' }}>Unable to Open Reassessment</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.65)', marginBottom: '24px', lineHeight: 1.6 }}>{error}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/student/learning-paths" className="btn btn-secondary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> Back to My Learning Paths
            </Link>
            <button onClick={initSession} className="btn btn-primary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Processing Stage Views
  if (processingStage !== 'idle') {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="card glass-card" style={{ padding: '48px', borderRadius: '20px', maxWidth: '600px', margin: '0 auto', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
          {processingStage === 'failed' ? (
            <div>
              <AlertCircle size={48} color="#ffffff" style={{ marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.4rem', color: '#ffffff' }}>Processing Failed</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.65)', marginBottom: '24px', lineHeight: 1.6 }}>{processingError}</p>
              <button
                onClick={() => handleProcessSubmission(attempt._id)}
                className="btn btn-primary"
                style={{ padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <RefreshCw size={16} /> Retry Evaluation
              </button>
            </div>
          ) : (
            <div>
              <BrainCircuit className="spin" size={52} color="#ffffff" style={{ marginBottom: '20px' }} />
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', color: '#ffffff' }}>Processing Reassessment Submission...</h3>

              {/* Stage Progress Indicators */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px', margin: '0 auto 24px auto', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff' }}>
                  <CheckCircle size={18} color="#ffffff" />
                  <span>1. Attempt Submitted</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: processingStage === 'evaluating' || processingStage === 'generating_diagnostic' || processingStage === 'comparison_ready' ? '#ffffff' : 'rgba(255, 255, 255, 0.45)' }}>
                  {processingStage === 'evaluating' ? <RefreshCw className="spin" size={18} color="#ffffff" /> : <CheckCircle size={18} color="#ffffff" />}
                  <span>2. Evaluating Student Responses</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: processingStage === 'generating_diagnostic' || processingStage === 'comparison_ready' ? '#ffffff' : 'rgba(255, 255, 255, 0.45)' }}>
                  {processingStage === 'generating_diagnostic' ? <RefreshCw className="spin" size={18} color="#ffffff" /> : <CheckCircle size={18} color="#ffffff" />}
                  <span>3. Analyzing Progress & Growth</span>
                </div>
              </div>

              <div className="badge" style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
                <Sparkles size={14} color="#ffffff" /> Student Learning Analysis Active
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const courseObj = attempt?.assessmentId?.courseId;
  const topicObj = attempt?.assessmentId?.topicId;
  const targetedConcepts = attempt?.assessmentId?.targetedConcepts || [];
  const assessmentTitle = attempt?.assessmentId?.title || 'Targeted Reassessment';

  return (
    <div className="container" style={{ padding: '30px 20px 60px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <Link to="/student/learning-paths" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'rgba(255, 255, 255, 0.65)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to My Learning Paths
        </Link>

        {!isReadOnly && (
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="btn btn-primary"
            style={{ padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Send size={16} /> Submit Reassessment
          </button>
        )}
      </div>

      {/* Reassessment Overview & Targeted Concepts Card */}
      <div className="card glass-card" style={{ padding: '28px', borderRadius: '16px', marginBottom: '28px', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.25)' }}>Targeted Reassessment</span>
              {courseObj?.code && <span className="badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}>{courseObj.code}</span>}
              {topicObj?.title && (
                <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={14} color="#ffffff" /> {topicObj.title}
                </span>
              )}
            </div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>{assessmentTitle}</h1>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.65)', display: 'block', marginBottom: '4px' }}>Progress</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
              {answeredCount} / {totalQuestions} Answered
            </span>
          </div>
        </div>

        {/* Targeted Weak Concepts List */}
        {targetedConcepts.length > 0 && (
          <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.2)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#ffffff', fontSize: '0.9rem', marginBottom: '6px' }}>
              <Target size={16} color="#ffffff" /> Targeted Weak Concepts from Previous Diagnosis:
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {targetedConcepts.map((concept, idx) => (
                <span key={idx} className="badge" style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
                  {concept}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="progress-bar-track" style={{ width: '100%', height: '8px' }}>
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Main Content Grid (Navigator Sidebar + Question Area) */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '28px' }}>
        {/* Left Navigator Sidebar */}
        <div className="card glass-card" style={{ padding: '20px', borderRadius: '16px', height: 'fit-content', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255, 255, 255, 0.65)' }}>
            Questions Navigator
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIdx;
              const hasAnswer = Boolean(responsesMap[q._id] && responsesMap[q._id].trim().length > 0);
              const saveState = savingStatus[q._id];

              let bg = '#000000';
              let border = '1px solid rgba(255, 255, 255, 0.15)';
              let color = 'rgba(255, 255, 255, 0.65)';

              if (hasAnswer) {
                bg = 'rgba(255, 255, 255, 0.15)';
                border = '1px solid rgba(255, 255, 255, 0.3)';
                color = '#ffffff';
              }

              if (isCurrent) {
                border = '2px solid #ffffff';
                if (!hasAnswer) color = '#ffffff';
              }

              return (
                <button
                  key={q._id || idx}
                  onClick={() => handleQuestionNavigate(idx)}
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    background: bg,
                    border,
                    color,
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  {idx + 1}
                  {saveState === 'saving' && (
                    <div style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff' }} />
                  )}
                  {saveState === 'error' && (
                    <div style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Question Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {currentQuestion ? (
            <div>
              {/* Permanent Reserved Save Status Container (Zero Layout Shift) */}
              <div
                className="response-save-status"
                style={{
                  height: '28px',
                  minHeight: '28px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  overflow: 'hidden'
                }}
              >
                {!isReadOnly && (() => {
                  const status = savingStatus[currentQuestion._id];
                  if (status === 'saving') {
                    return (
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={12} color="#ffffff" className="spin" /> Saving...
                      </span>
                    );
                  }
                  if (status === 'saved') {
                    return (
                      <span style={{ fontSize: '0.75rem', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Save size={12} color="#ffffff" /> Response saved to server
                      </span>
                    );
                  }
                  if (status === 'error') {
                    return (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#ffffff' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={12} color="#ffffff" /> Failed to save response
                        </span>
                        <button onClick={() => handleRetrySave(currentQuestion._id)} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>Retry</button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <QuestionRenderer
                key={currentQuestion._id}
                question={currentQuestion}
                questionNumber={currentIdx + 1}
                totalQuestions={totalQuestions}
                currentValue={responsesMap[currentQuestion._id] || ''}
                onChange={handleAnswerChange}
                disabled={isReadOnly}
              />
            </div>
          ) : (
            <div className="card glass-card" style={{ padding: '40px', textAlign: 'center', borderRadius: '16px', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
              <HelpCircle size={36} color="#ffffff" style={{ marginBottom: '12px', opacity: 0.6 }} />
              <p style={{ color: '#ffffff' }}>No question available.</p>
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
            <button
              onClick={() => handleQuestionNavigate(Math.max(currentIdx - 1, 0))}
              disabled={currentIdx === 0}
              className="btn btn-secondary"
              style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', opacity: currentIdx === 0 ? 0.5 : 1 }}
            >
              <ChevronLeft size={18} /> Previous Question
            </button>

            {currentIdx < totalQuestions - 1 ? (
              <button
                onClick={() => handleQuestionNavigate(Math.min(currentIdx + 1, totalQuestions - 1))}
                className="btn btn-secondary"
                style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Next Question <ChevronRight size={18} />
              </button>
            ) : (
              !isReadOnly && (
                <button
                  onClick={() => {
                    if (currentQuestion?._id) flushPendingSave(currentQuestion._id);
                    setIsSubmitModalOpen(true);
                  }}
                  className="btn btn-primary"
                  style={{ padding: '10px 22px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Send size={16} /> Submit Reassessment
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <SubmitConfirmationModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        isSubmitting={isSubmitting}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
      />
    </div>
  );
};
