import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { assessmentService } from '../services/assessment.service';
import { useAuth } from '../hooks/useAuth';
import { BookOpen, Play, CheckCircle, RefreshCw, AlertCircle, Clock, Award, Layers } from 'lucide-react';

export const StudentAssessmentListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(null);

  const fetchAssessments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await assessmentService.getStudentAssessments();
      setAssessments(data);
    } catch (err) {
      console.error('Failed to fetch student assessments:', err);
      setError(err.message || 'Unable to load available assessments. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, []);

  const handleJoinAssessment = async (e) => {
    e.preventDefault();
    if (!accessCodeInput.trim() || isJoining) return;

    setIsJoining(true);
    setJoinError(null);
    setJoinSuccess(null);

    try {
      const res = await assessmentService.joinAssessment(accessCodeInput.trim());
      setJoinSuccess(res.message || 'Successfully joined assessment!');
      setAccessCodeInput('');
      await fetchAssessments();
    } catch (err) {
      console.error('Failed to join assessment:', err);
      setJoinError(err.message || 'Invalid assessment access code.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartOrResume = (item) => {
    const isReassessment = item.type === 'reassessment' || item.assessmentType === 'reassessment';
    const targetId = item._id || item.assessmentId;

    if (isReassessment) {
      if (item.canStart || item.canResume) {
        navigate(`/student/reassessments/${targetId}`);
      } else if (item.attemptId) {
        navigate(`/student/reassessments/attempt/${item.attemptId}/comparison`);
      } else {
        navigate('/student/progress');
      }
    } else {
      if (item.canStart || item.canResume) {
        navigate(`/student/assessments/${targetId}`);
      } else {
        navigate('/student/progress');
      }
    }
  };

  const isCompletedStatus = (st) =>
    ['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed'].includes(st);

  const getStatusBadge = (item) => {
    const status = item.attemptStatus || item.userAttemptStatus;
    if (isCompletedStatus(status)) {
      return <span className="badge" style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.3)' }}>Completed</span>;
    }
    if (item.canResume || status === 'in_progress') {
      return <span className="badge" style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}>In Progress</span>;
    }
    return <span className="badge" style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.3)' }}>Assigned</span>;
  };

  const getDifficultyBadge = (difficulty) => {
    return <span className="badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}>{difficulty || 'Medium'}</span>;
  };

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{
        padding: '32px',
        borderRadius: '20px',
        marginBottom: '30px',
        background: '#000000',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <BookOpen color="#ffffff" size={24} />
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
              My Assessments
            </h1>
          </div>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', fontSize: '1rem' }}>
            Welcome back, <strong>{user?.name || 'Student'}</strong>! Join a new assessment using an access code or continue your assigned assessments below.
          </p>
        </div>

        <button
          onClick={fetchAssessments}
          className="btn btn-secondary"
          disabled={isLoading}
          style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> Refresh List
        </button>
      </div>

      {/* Join Assessment Card */}
      <div className="card glass-card" style={{
        padding: '24px 28px',
        borderRadius: '16px',
        marginBottom: '36px',
        background: '#000000',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
          <Award size={20} color="#ffffff" /> Join New Assessment
        </h3>
        <p style={{ margin: '0 0 16px 0', color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.9rem' }}>
          Enter the unique 6-character access code provided by your teacher (e.g. <code>LC-7F4K2P</code>) to join and unlock your assessment.
        </p>

        <form onSubmit={handleJoinAssessment} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Enter Assessment Code (e.g. LC-7F4K2P)"
            value={accessCodeInput}
            onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
            maxLength={10}
            style={{
              flex: '1',
              minWidth: '240px',
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: '#000000',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '1px'
            }}
          />
          <button
            type="submit"
            disabled={!accessCodeInput.trim() || isJoining}
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {isJoining ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
            Join Assessment
          </button>
        </form>

        {joinError && (
          <div style={{ marginTop: '12px', color: '#ffffff', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} color="#ffffff" /> {joinError}
          </div>
        )}

        {joinSuccess && (
          <div style={{ marginTop: '12px', color: '#ffffff', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={16} color="#ffffff" /> {joinSuccess}
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          color: '#ffffff',
          marginBottom: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} color="#ffffff" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAssessments}
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="card glass-card" style={{ padding: '24px', borderRadius: '16px', height: '220px', opacity: 0.6 }}>
              <div style={{ width: '60%', height: '20px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '6px', marginBottom: '16px' }} />
              <div style={{ width: '40%', height: '14px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '4px', marginBottom: '24px' }} />
              <div style={{ width: '90%', height: '14px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '4px', marginBottom: '24px' }} />
              <div style={{ width: '100%', height: '40px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '8px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && assessments.length === 0 && (
        <div className="card glass-card" style={{
          padding: '60px 20px',
          textAlign: 'center',
          borderRadius: '20px',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          <Award size={48} color="#ffffff" style={{ marginBottom: '16px', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.3rem', marginBottom: '8px', color: '#ffffff' }}>No Assessments Found</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.65)', maxWidth: '480px', margin: '0 auto 24px' }}>
            There are currently no published assessments available for your enrolled courses. Check back later or contact your teacher.
          </p>
        </div>
      )}

      {/* Assessment Cards Grid */}
      {!isLoading && !error && assessments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {assessments.map((item) => {
            const course = item.courseId;
            const topic = item.topicId;

            return (
              <div
                key={item._id}
                className="card glass-card"
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: '#000000',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
              >
                <div>
                  {/* Card Header & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span className="badge" style={{ fontSize: '0.75rem', fontWeight: 600, background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                      {course?.code || 'COURSE'}
                    </span>
                    {getStatusBadge(item)}
                  </div>

                  {/* Title & Description */}
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.4, color: '#ffffff' }}>
                    {item.title}
                  </h3>

                  <p style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.65)',
                    margin: '0 0 16px 0',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {item.description || `Diagnostic assessment for ${topic?.title || 'this topic'}.`}
                  </p>

                  {/* Course & Topic Information */}
                  <div style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#000000',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff' }}>
                      <Layers size={14} color="#ffffff" />
                      <strong>Topic:</strong> {topic?.title || 'General Topic'}
                    </div>
                    {course?.title && (
                      <div style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                        <strong>Course:</strong> {course.title} {course.subject ? `(${course.subject})` : ''}
                      </div>
                    )}
                  </div>

                  {/* Metadata Chips */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.65)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} /> {item.totalQuestions || 0} Questions
                    </span>
                    {getDifficultyBadge(item.difficulty)}
                  </div>
                </div>

                {/* Card Action Button */}
                <div>
                  {item.canStart ? (
                    <button
                      onClick={() => handleStartOrResume(item)}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Play size={16} /> Start Assessment
                    </button>
                  ) : item.canResume ? (
                    <button
                      onClick={() => handleStartOrResume(item)}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Play size={16} /> Resume Assessment
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartOrResume(item)}
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <CheckCircle size={16} color="#ffffff" /> View Progress & Results
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
