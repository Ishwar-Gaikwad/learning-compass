import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { attemptService } from '../services/attempt.service';
import { diagnosticService } from '../services/diagnostic.service';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { SubmitConfirmationModal } from '../components/SubmitConfirmationModal';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Layers,
  HelpCircle
} from 'lucide-react';

export const StudentAssessmentPage = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  // Core Attempt State
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responsesMap, setResponsesMap] = useState({}); // { [questionId]: answer }
  const [savingStatus, setSavingStatus] = useState({}); // { [questionId]: 'idle'|'saving'|'saved'|'error' }

  // Page UI States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Post-submission Async Processing State: 'idle' | 'evaluating' | 'completed' | 'failed'
  const [processingState, setProcessingState] = useState('idle');
  const [processingError, setProcessingError] = useState(null);

  // Poll attempt & diagnostic report status until completed or failed
  const pollDiagnosticReport = useCallback((targetAttemptId) => {
    setProcessingState('evaluating');
    setProcessingError(null);

    let pollCount = 0;
    const maxPolls = 40;
    let intervalId = null;

    const checkOnce = async () => {
      pollCount += 1;

      try {
        // 1. Check if DiagnosticReport exists
        const report = await diagnosticService.getDiagnosticReport(targetAttemptId).catch(() => null);
        if (report) {
          if (intervalId) clearInterval(intervalId);
          setProcessingState('completed');
          setTimeout(() => {
            navigate('/student/progress', { replace: true });
          }, 1200);
          return true;
        }

        // 2. Check attempt status on backend
        const attemptDetails = await attemptService.getAttemptById(targetAttemptId).catch(() => null);
        if (attemptDetails?.attempt) {
          const currentStatus = attemptDetails.attempt.status;
          if (currentStatus === 'evaluated') {
            if (intervalId) clearInterval(intervalId);
            setProcessingState('completed');
            setTimeout(() => {
              navigate('/student/progress', { replace: true });
            }, 1200);
            return true;
          }

          if (currentStatus === 'failed') {
            if (intervalId) clearInterval(intervalId);
            setProcessingState('failed');
            setProcessingError(attemptDetails.attempt.processingError || 'AI diagnostic analysis failed on server.');
            return true;
          }
        }

        if (pollCount >= maxPolls) {
          if (intervalId) clearInterval(intervalId);
          setProcessingState('failed');
          setProcessingError('Diagnostic report generation timed out. You can retry analysis or view your progress dashboard.');
          return true;
        }
      } catch (pollErr) {
        console.warn('[StudentAssessmentPage] Status poll warning:', pollErr);
      }
      return false;
    };

    // Immediate check at T=0
    checkOnce().then((isDone) => {
      if (!isDone) {
        intervalId = setInterval(checkOnce, 2000);
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [navigate]);

  // Initialize or restore active attempt session
  const initAttemptSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First attempt to start or resume active attempt session
      const data = await attemptService.startAttempt(assessmentId);
      const attemptDoc = data.attempt;

      if (!attemptDoc || !attemptDoc.assessmentId) {
        throw new Error('Invalid assessment session data received from server.');
      }

      setAttempt(attemptDoc);

      const assessmentObj = attemptDoc.assessmentId;
      const loadedQuestions = assessmentObj.questions || [];
      setQuestions(loadedQuestions);

      // Fetch saved responses for this active/submitted attempt
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

      if (attemptDoc.status === 'submitted') {
        setSubmitSuccess(true);
        pollDiagnosticReport(attemptDoc._id);
      } else if (attemptDoc.status === 'evaluated') {
        setSubmitSuccess(true);
        setProcessingState('completed');
      } else if (attemptDoc.status === 'failed') {
        setSubmitSuccess(true);
        setProcessingState('failed');
        setProcessingError(attemptDoc.processingError || 'Previous diagnostic evaluation failed.');
      }
    } catch (err) {
      console.error('[StudentAssessmentPage] Session initialization failed:', err);
      setError(err.message || 'Unable to load assessment session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId, pollDiagnosticReport]);

  useEffect(() => {
    initAttemptSession();
  }, [initAttemptSession]);

  // Derived state calculations
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
  const isReadOnly = attempt?.status === 'submitted' || attempt?.status === 'evaluated' || attempt?.status === 'completed' || attempt?.status === 'failed' || submitSuccess || processingState !== 'idle';

  const saveTimersRef = useRef({});

  // Auto-save response to backend API
  const persistResponse = async (questionId, answer) => {
    if (!attempt || isReadOnly) return;

    setSavingStatus((prev) => ({ ...prev, [questionId]: 'saving' }));

    try {
      await attemptService.saveResponse(attempt._id, questionId, answer);
      setSavingStatus((prev) => ({ ...prev, [questionId]: 'saved' }));
    } catch (err) {
      console.error(`[StudentAssessmentPage] Save response failed for Q:${questionId}:`, err);
      setSavingStatus((prev) => ({ ...prev, [questionId]: 'error' }));
    }
  };

  // Handle local user input changes with 800ms debounce
  const handleAnswerChange = (newAnswer) => {
    if (!currentQuestion || isReadOnly) return;

    const qId = currentQuestion._id;

    // Update local state immediately for 0-latency typing
    setResponsesMap((prev) => ({ ...prev, [qId]: newAnswer }));

    // Cancel previous pending save timer for this question
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

  // Flush any pending save timer before navigating away
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

  // Question navigation handler that flushes pending save first
  const handleQuestionNavigate = (newIdx) => {
    if (currentQuestion?._id) {
      flushPendingSave(currentQuestion._id);
    }
    setCurrentIdx(newIdx);
  };

  // Clean up all pending save timers on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timerId) => {
        if (timerId) clearTimeout(timerId);
      });
    };
  }, []);

  // Manual retry for failed response saves
  const handleRetrySave = (qId) => {
    const answer = responsesMap[qId];
    if (qId && answer) {
      persistResponse(qId, answer);
    }
  };

  // Handle final submission
  const handleConfirmSubmit = async () => {
    if (!attempt || isReadOnly || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await attemptService.submitAttempt(attempt._id);
      setAttempt(res.attempt);
      setSubmitSuccess(true);
      setIsSubmitModalOpen(false);

      // Start post-submission evaluation & diagnostic polling
      pollDiagnosticReport(res.attempt._id);
    } catch (err) {
      console.error('[StudentAssessmentPage] Submission failed:', err);
      alert(err.message || 'Failed to submit assessment attempt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry processing after failure
  const handleRetryProcessing = async () => {
    if (!attempt) return;
    setProcessingState('evaluating');
    setProcessingError(null);

    try {
      await diagnosticService.generateDiagnosticReport(attempt._id);
      pollDiagnosticReport(attempt._id);
    } catch (err) {
      console.error('[StudentAssessmentPage] Retry diagnostic failed:', err);
      setProcessingState('failed');
      setProcessingError(err.message || 'Failed to trigger diagnostic evaluation.');
    }
  };

  // Prevent accidental tab closure if unpersisted edits exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const hasPendingError = Object.values(savingStatus).some((st) => st === 'error' || st === 'saving');
      if (hasPendingError && !isReadOnly) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [savingStatus, isReadOnly]);

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="card glass-card" style={{ padding: '40px', borderRadius: '20px', maxWidth: '500px', margin: '0 auto', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <RefreshCw className="spin" size={40} color="#ffffff" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#ffffff' }}>Loading Assessment...</h3>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.9rem' }}>
            Retrieving questions and restoring your active session.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '60px 20px' }}>
        <div className="card glass-card" style={{ padding: '40px', borderRadius: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
          <AlertCircle size={48} color="#ffffff" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.4rem', color: '#ffffff' }}>Unable to Open Assessment</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.65)', marginBottom: '24px', lineHeight: 1.6 }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/student/assessments" className="btn btn-secondary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> Back to Assessments
            </Link>
            <button onClick={initAttemptSession} className="btn btn-primary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const courseObj = attempt?.assessmentId?.courseId;
  const topicObj = attempt?.assessmentId?.topicId;
  const assessmentTitle = attempt?.assessmentId?.title || 'Student Assessment';

  return (
    <div className="container" style={{ padding: '30px 20px 60px' }}>
      {/* Top Breadcrumb & Action Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <Link to="/student/assessments" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'rgba(255, 255, 255, 0.65)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to Available Assessments
        </Link>

        {!isReadOnly && (
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="btn btn-primary"
            style={{ padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Send size={16} /> Submit Assessment
          </button>
        )}
      </div>

      {/* Post-Submission Async Processing View */}
      {processingState === 'evaluating' && (
        <div className="card glass-card" style={{
          padding: '40px 28px',
          borderRadius: '20px',
          marginBottom: '28px',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', marginBottom: '16px' }}>
            <RefreshCw size={36} color="#ffffff" className="spin" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
            Assessment Submitted — Analyzing Your Responses
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.95rem', maxWidth: '550px', margin: '0 auto 24px' }}>
            We are evaluating your answers, assessing your conceptual understanding, and preparing your diagnostic report...
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={16} /> 1. Responses Locked
            </span>
            <span style={{ color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={16} className="spin" /> 2. Evaluating Response Concepts
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.45)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} /> 3. Preparing Diagnostic Report
            </span>
          </div>
        </div>
      )}

      {/* Processing Completed Banner */}
      {processingState === 'completed' && (
        <div className="card glass-card" style={{
          padding: '32px 28px',
          borderRadius: '20px',
          marginBottom: '28px',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          textAlign: 'center'
        }}>
          <CheckCircle size={44} color="#ffffff" style={{ marginBottom: '12px' }} />
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
            Diagnostic Report Ready!
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.95rem', margin: 0 }}>
            Redirecting to your student progress dashboard...
          </p>
        </div>
      )}

      {/* Processing Failure Banner */}
      {processingState === 'failed' && (
        <div className="card glass-card" style={{
          padding: '32px 28px',
          borderRadius: '20px',
          marginBottom: '28px',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          textAlign: 'center'
        }}>
          <AlertCircle size={40} color="#ffffff" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
            Assessment Submitted — Diagnostic Analysis Pending
          </h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto 16px', lineHeight: 1.5 }}>
            Your assessment responses were recorded and locked successfully, but automated diagnostic analysis encountered a delay or server issue.
          </p>
          {processingError && (
            <div style={{ background: '#000000', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', color: '#ffffff', marginBottom: '20px', display: 'inline-block' }}>
              Error: {processingError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleRetryProcessing} className="btn btn-primary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Retry Diagnostic Analysis
            </button>
            <Link to="/student/progress" className="btn btn-secondary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> View Progress Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Header Info & Progress Card */}
      <div className="card glass-card" style={{
        padding: '24px 28px',
        borderRadius: '16px',
        marginBottom: '28px',
        background: '#000000',
        border: '1px solid rgba(255, 255, 255, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
                {courseObj?.code || 'COURSE'}
              </span>
              {topicObj?.title && (
                <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={14} color="#ffffff" /> {topicObj.title}
                </span>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}>
              {assessmentTitle}
            </h1>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.65)', display: 'block', marginBottom: '4px' }}>
              Progress
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
              {answeredCount} / {totalQuestions} Answered
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar-track" style={{ width: '100%', height: '8px' }}>
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Main Assessment Content Grid (Sidebar + Question Area) */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '28px' }}>
        {/* Left Navigator Sidebar */}
        <div className="card glass-card" style={{
          padding: '20px',
          borderRadius: '16px',
          height: 'fit-content',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
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
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Question ${idx + 1}: ${hasAnswer ? 'Answered' : 'Unanswered'}`}
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

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)', paddingTop: '16px', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.65)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.3)' }} />
              <span>Answered</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#000000', border: '1px solid rgba(255, 255, 255, 0.15)' }} />
              <span>Unanswered</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', border: '2px solid #ffffff' }} />
              <span>Current Question</span>
            </div>
          </div>
        </div>

        {/* Right Active Question Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Question Item Card */}
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
                        <button
                          onClick={() => handleRetrySave(currentQuestion._id)}
                          className="btn btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                        >
                          Retry
                        </button>
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

          {/* Navigation Control Buttons */}
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
                  <Send size={16} /> Submit Assessment
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
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
