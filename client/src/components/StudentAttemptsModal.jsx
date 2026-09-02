import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagnosticService } from '../services/diagnostic.service';
import { FileText, Clock, AlertCircle, RefreshCw, ChevronRight, ChevronDown, ChevronUp, User, Award } from 'lucide-react';
import { Modal, Button } from './common';

export const StudentAttemptsModal = ({ isOpen, onClose, assessment }) => {
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedResponses, setExpandedResponses] = useState({});

  useEffect(() => {
    if (isOpen && assessment?._id) {
      fetchAttempts();
    }
  }, [isOpen, assessment]);

  const fetchAttempts = async () => {
    if (!assessment?._id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await diagnosticService.getAssessmentAttempts(assessment._id);
      setAttempts(data);
    } catch (err) {
      console.error('Failed to fetch assessment attempts:', err);
      setError(err.message || 'Unable to load student attempts for this assessment.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAttempt = (attemptId) => {
    onClose();
    navigate(`/teacher/attempts/${attemptId}/report`, {
      state: {
        assessmentId: assessment?._id,
        topicId: assessment?.topicId?._id || assessment?.topicId,
        courseId: assessment?.courseId?._id || assessment?.courseId
      }
    });
  };

  const toggleResponses = (attemptId) => {
    setExpandedResponses((prev) => ({ ...prev, [attemptId]: !prev[attemptId] }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'evaluated':
      case 'completed':
        return <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Evaluated</span>;
      case 'submitted':
        return <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>Submitted</span>;
      case 'in_progress':
      default:
        return <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>In Progress</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group attempts per student
  const studentGroups = useMemo(() => {
    const map = {};

    attempts.forEach((attempt) => {
      const student = attempt.studentId;
      const studentId = student?._id || attempt.studentId;
      if (!studentId) return;

      if (!map[studentId]) {
        map[studentId] = {
          student,
          initialAttempt: null,
          reassessments: []
        };
      }

      const isReassessment = attempt.assessmentId?.type === 'reassessment';
      if (isReassessment) {
        map[studentId].reassessments.push(attempt);
      } else {
        if (!map[studentId].initialAttempt || attempt.status === 'evaluated') {
          map[studentId].initialAttempt = attempt;
        }
      }
    });

    return Object.values(map);
  }, [attempts]);

  const renderResponsesList = (responses = []) => {
    if (!responses || responses.length === 0) {
      return (
        <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#B3B3B3', fontStyle: 'italic' }}>
          No responses recorded for this attempt.
        </div>
      );
    }

    return (
      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {responses.map((resp, qIdx) => {
          const question = resp.questionId;
          return (
            <div key={resp._id || qIdx} style={{ padding: '10px 14px', borderRadius: '6px', background: '#121212', border: '1px solid #2A2A2A', fontSize: '0.85rem' }}>
              <div style={{ color: '#FF8A00', fontWeight: 600, marginBottom: '4px' }}>
                Q{qIdx + 1}: {question?.questionText || 'Question'}
              </div>
              <div style={{ color: '#ffffff', marginBottom: '4px' }}>
                <strong>Answer:</strong> {resp.studentAnswer || '(No response provided)'}
              </div>
              {question?.correctAnswer && (
                <div style={{ color: '#B3B3B3', fontSize: '0.8rem' }}>
                  <strong>Correct Answer:</strong> {question.correctAnswer}
                </div>
              )}
              {resp.evaluationFeedback && (
                <div style={{ color: '#B3B3B3', fontSize: '0.8rem', marginTop: '4px', fontStyle: 'italic' }}>
                  Feedback: {resp.evaluationFeedback}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const footer = (
    <Button variant="secondary" onClick={onClose}>
      Close
    </Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Attempts & Reports"
      subtitle={assessment?.title || 'Assessment'}
      footer={footer}
      size="lg"
    >
      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#ffffff',
            marginBottom: '20px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color="#ffffff" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchAttempts}>
            Retry
          </Button>
        </div>
      )}

      {/* Content Body */}
      <div>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#B3B3B3' }}>
            <RefreshCw className="spin" size={28} color="#FF8A00" style={{ margin: '0 auto 12px' }} />
            <p>Loading student attempts & reports...</p>
          </div>
        ) : studentGroups.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#B3B3B3' }}>
            <Clock size={36} color="#FF8A00" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h4 style={{ margin: '0 0 6px 0', color: '#ffffff' }}>No Student Attempts Yet</h4>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              No students have started or submitted this assessment yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: '#B3B3B3', marginBottom: '4px' }}>
              Showing attempt history for {studentGroups.length} student{studentGroups.length === 1 ? '' : 's'}.
            </div>

            {studentGroups.map(({ student, initialAttempt, reassessments }) => {
              const latestReport = reassessments.length > 0
                ? reassessments[reassessments.length - 1].diagnosticReport
                : initialAttempt?.diagnosticReport;

              const isMastered = latestReport?.masteryLevel === 'mastered' || (latestReport?.overallMasteryScore >= 75);

              return (
                <div
                  key={student?._id || student?.email}
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: '#121212',
                    border: '1px solid #2A2A2A',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}
                >
                  {/* Student Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #2A2A2A', paddingBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} color="#FF8A00" />
                        <strong style={{ fontSize: '1.05rem', color: '#ffffff' }}>{student?.name || 'Student'}</strong>
                        <span style={{ fontSize: '0.85rem', color: '#B3B3B3' }}>({student?.email || 'N/A'})</span>
                      </div>
                    </div>

                    <div>
                      {isMastered ? (
                        <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>MASTERED</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>NEEDS REASSESSMENT</span>
                      )}
                    </div>
                  </div>

                  {/* Initial Attempt Sub-Card */}
                  {initialAttempt && (
                    <div style={{ padding: '14px 16px', borderRadius: '8px', background: '#000000', border: '1px solid #2A2A2A' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>Initial Assessment</span>
                            {getStatusBadge(initialAttempt.status)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#B3B3B3' }}>
                            Started: {formatDate(initialAttempt.startedAt)} | Submitted: {formatDate(initialAttempt.submittedAt)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleResponses(initialAttempt._id)}
                            icon={expandedResponses[initialAttempt._id] ? ChevronUp : ChevronDown}
                          >
                            View Responses ({initialAttempt.responses?.length || 0})
                          </Button>
                          {(initialAttempt.status === 'submitted' || initialAttempt.status === 'evaluated') && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSelectAttempt(initialAttempt._id)}
                              icon={FileText}
                            >
                              Diagnostic Report
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Responses List */}
                      {expandedResponses[initialAttempt._id] && renderResponsesList(initialAttempt.responses)}
                    </div>
                  )}

                  {/* Targeted Reassessment Sub-Cards */}
                  {reassessments.map((reassessmentAttempt, idx) => (
                    <div
                      key={reassessmentAttempt._id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '8px',
                        background: '#000000',
                        border: '1px solid #2A2A2A',
                        marginLeft: '16px',
                        borderLeft: '3px solid #FF8A00'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#FF8A00' }}>
                              Targeted Reassessment #{idx + 1}
                            </span>
                            {getStatusBadge(reassessmentAttempt.status)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#B3B3B3' }}>
                            Submitted: {formatDate(reassessmentAttempt.submittedAt)}
                            {reassessmentAttempt.assessmentId?.targetedConcepts?.length > 0 && (
                              <span> | Concepts: {reassessmentAttempt.assessmentId.targetedConcepts.join(', ')}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleResponses(reassessmentAttempt._id)}
                            icon={expandedResponses[reassessmentAttempt._id] ? ChevronUp : ChevronDown}
                          >
                            View Responses ({reassessmentAttempt.responses?.length || 0})
                          </Button>
                          {(reassessmentAttempt.status === 'submitted' || reassessmentAttempt.status === 'evaluated') && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSelectAttempt(reassessmentAttempt._id)}
                              icon={FileText}
                            >
                              Diagnostic Report
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Responses List */}
                      {expandedResponses[reassessmentAttempt._id] && renderResponsesList(reassessmentAttempt.responses)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
