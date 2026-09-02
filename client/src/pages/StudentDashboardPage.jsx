import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { assessmentService } from '../services/assessment.service';
import { learningPathService } from '../services/learningPath.service';
import { reassessmentService } from '../services/reassessment.service';
import {
  LayoutDashboard,
  BookOpen,
  Route as PathIcon,
  TrendingUp,
  Play,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Award,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Layers
} from 'lucide-react';

export const StudentDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [assessments, setAssessments] = useState([]);
  const [learningPaths, setLearningPaths] = useState([]);
  const [recentComparison, setRecentComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLaunchingReassessment, setIsLaunchingReassessment] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [assessmentsData, pathsData] = await Promise.all([
        assessmentService.getStudentAssessments().catch((err) => {
          console.warn('Failed to fetch assessments:', err);
          return [];
        }),
        learningPathService.getStudentLearningPaths().catch((err) => {
          console.warn('Failed to fetch learning paths:', err);
          return [];
        })
      ]);

      setAssessments(assessmentsData || []);
      setLearningPaths(pathsData || []);

      const submittedAssessment = (assessmentsData || []).find(
        (a) => (a.userAttemptStatus === 'submitted' || a.userAttemptStatus === 'evaluated') && a.attemptId
      );

      if (submittedAssessment?.attemptId) {
        try {
          const compData = await reassessmentService.getReassessmentComparison(submittedAssessment.attemptId);
          if (compData) {
            setRecentComparison(compData);
          }
        } catch (compErr) {
          console.info('No recent comparison available for attempt:', submittedAssessment.attemptId);
        }
      }
    } catch (err) {
      console.error('Student dashboard loading failed:', err);
      setError(err.message || 'Unable to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const isCompletedStatus = (st) =>
    ['submitted', 'evaluating', 'evaluated', 'generating_diagnostic', 'completed'].includes(st);

  const inProgressAssessments = assessments.filter((a) => a.userAttemptStatus === 'in_progress');
  const availableAssessments = assessments.filter((a) => !isCompletedStatus(a.userAttemptStatus) && a.userAttemptStatus !== 'in_progress');

  const activePaths = learningPaths.filter((p) => p.status === 'active' && !p.isMastered);
  const readyForReassessmentPath = learningPaths.find(
    (p) => p.isReadyForReassessment && !p.isMastered && p.status !== 'completed'
  );

  const handleStartOrResumeAssessment = (assessmentId) => {
    navigate(`/student/assessments/${assessmentId}`);
  };

  const handleLaunchReassessment = async (diagnosticReportId) => {
    if (!diagnosticReportId || isLaunchingReassessment) return;
    setIsLaunchingReassessment(true);
    try {
      const res = await reassessmentService.generateReassessment(diagnosticReportId);
      if (res && res.reassessment) {
        navigate(`/student/reassessments/${res.reassessment._id}`);
      }
    } catch (err) {
      console.error('Failed to generate targeted reassessment:', err);
      alert(err.message || 'Unable to launch reassessment. Please try again.');
    } finally {
      setIsLaunchingReassessment(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_progress':
        return <span className="badge badge-warning">In Progress</span>;
      case 'submitted':
      case 'evaluating':
      case 'evaluated':
      case 'generating_diagnostic':
      case 'completed':
        return <span className="badge badge-success" style={{ color: '#FFFFFF' }}>Completed</span>;
      case 'not_started':
      case 'assigned':
      default:
        return <span className="badge badge-orange">Available</span>;
    }
  };

  return (
    <div className="container" style={{ padding: '30px 20px 60px' }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          padding: '28px',
          borderRadius: '12px',
          marginBottom: '32px',
          background: '#121212',
          border: '1px solid #2A2A2A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Compass color="#FF8A00" size={26} />
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: '#FFFFFF' }}>
              Student Dashboard
            </h1>
          </div>
          <p style={{ margin: 0, color: '#B3B3B3', fontSize: '0.95rem' }}>
            Welcome back, <strong style={{ color: '#FFFFFF' }}>{user?.name || 'Student'}</strong>! Track your diagnostic assessments, personalized learning paths, and conceptual progress.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          className="btn btn-secondary"
          disabled={isLoading}
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh Data
        </button>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '32px', borderBottom: '1px solid #2A2A2A', paddingBottom: '12px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('overview')}
          className={activeTab === 'overview' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <LayoutDashboard size={15} /> Overview
        </button>

        <button
          onClick={() => setActiveTab('assessments')}
          className={activeTab === 'assessments' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <BookOpen size={15} /> My Assessments ({assessments.length})
        </button>

        <button
          onClick={() => setActiveTab('learning')}
          className={activeTab === 'learning' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <PathIcon size={15} /> My Learning Paths{activePaths.length > 0 ? ` (${activePaths.length})` : ''}
        </button>

        <button
          onClick={() => setActiveTab('progress')}
          className={activeTab === 'progress' ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <TrendingUp size={15} /> Progress & Reports
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid #2A2A2A',
            color: '#EF4444',
            marginBottom: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} color="#EF4444" />
            <span>{error}</span>
          </div>
          <button onClick={fetchDashboardData} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="card" style={{ padding: '24px', borderRadius: '12px', height: '160px', opacity: 0.6, background: '#121212', border: '1px solid #2A2A2A' }}>
              <div style={{ width: '50%', height: '18px', background: '#2A2A2A', borderRadius: '4px', marginBottom: '16px' }} />
              <div style={{ width: '80%', height: '12px', background: '#2A2A2A', borderRadius: '4px', marginBottom: '24px' }} />
              <div style={{ width: '100%', height: '32px', background: '#2A2A2A', borderRadius: '6px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Main Tab Content */}
      {!isLoading && (
        <>
          {/* SECTION 1: OVERVIEW */}
          {(activeTab === 'overview' || activeTab === 'all') && (
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                <LayoutDashboard size={20} color="#FF8A00" /> Overview Summary
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {/* Metric 1 */}
                <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '6px' }}>Total Diagnostic Assessments</span>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FF8A00' }}>{assessments.length}</div>
                  <span style={{ fontSize: '0.8rem', color: '#808080' }}>Assigned across registered topics</span>
                </div>

                {/* Metric 2 */}
                <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '6px' }}>Active Learning Paths</span>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FF8A00' }}>{activePaths.length}</div>
                  <span style={{ fontSize: '0.8rem', color: '#808080' }}>Learning paths active</span>
                </div>

                {/* Metric 3 */}
                <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '6px' }}>Targeted Reassessment Ready</span>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {readyForReassessmentPath ? '1' : '0'}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#808080' }}>Activities 100% completed</span>
                </div>

                {/* Metric 4 */}
                <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '6px' }}>Improved Concepts</span>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FFFFFF' }}>
                    {recentComparison?.improvedConcepts?.length || 0}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#808080' }}>Recovered concept gaps</span>
                </div>
              </div>

              {/* Ready for Reassessment Alert Banner */}
              {readyForReassessmentPath && (
                <div
                  className="card"
                  style={{
                    padding: '20px 24px',
                    borderRadius: '12px',
                    marginBottom: '32px',
                    background: '#121212',
                    border: '1px solid #2A2A2A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <CheckCircle2 size={24} color="#22C55E" />
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', color: '#FFFFFF' }}>
                        Ready for Targeted Reassessment!
                      </h4>
                      <p style={{ margin: 0, color: '#B3B3B3', fontSize: '0.875rem' }}>
                        You have completed all learning activities for <strong>{readyForReassessmentPath.topicId?.title || 'Topic'}</strong>.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleLaunchReassessment(readyForReassessmentPath.diagnosticReportId)}
                    disabled={isLaunchingReassessment}
                    className="btn btn-success"
                    style={{ padding: '8px 18px', fontSize: '0.85rem', color: '#FFFFFF' }}
                  >
                    {isLaunchingReassessment ? 'Launching...' : 'Start Targeted Reassessment'} <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: MY ASSESSMENTS */}
          {(activeTab === 'assessments' || activeTab === 'all') && (
            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                  <BookOpen size={20} color="#FF8A00" /> Available Diagnostic Assessments ({assessments.length})
                </h2>
                <Link to="/student/assessments" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                  View All Assessments <ArrowRight size={12} />
                </Link>
              </div>

              {assessments.length === 0 ? (
                <div className="card" style={{ padding: '36px', textAlign: 'center', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <BookOpen size={32} color="#808080" style={{ marginBottom: '12px' }} />
                  <p style={{ color: '#B3B3B3', margin: 0 }}>No diagnostic assessments assigned to your account yet.</p>
                </div>
              ) : (
                <div className="grid-3">
                  {assessments.map((ass) => {
                    const st = ass.userAttemptStatus || 'not_started';
                    const isDone = isCompletedStatus(st) || ass.hasCompletedAttempt;
                    const isReassessment = ass.assessmentType === 'reassessment' || ass.type === 'reassessment';

                    return (
                      <div key={ass._id} className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            {getStatusBadge(st)}
                            <span className="badge badge-orange">{ass.difficulty || 'medium'}</span>
                          </div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px', color: '#FFFFFF' }}>{ass.title}</h4>
                          <p style={{ color: '#B3B3B3', fontSize: '0.85rem', marginBottom: '16px' }}>
                            {ass.topicId?.title ? `Topic: ${ass.topicId.title}` : 'Diagnostic Assessment'}
                          </p>
                        </div>

                        <div>
                          {isDone ? (
                            isReassessment ? (
                              <Link to={`/student/progress`} className="btn btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}>
                                <CheckCircle size={14} color="#22C55E" /> View Progress & Results
                              </Link>
                            ) : (
                              <Link to={`/student/learning-paths`} className="btn btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}>
                                <CheckCircle size={14} color="#22C55E" /> View Learning Path
                              </Link>
                            )
                          ) : st === 'in_progress' || ass.canResume ? (
                            <button onClick={() => handleStartOrResumeAssessment(ass._id)} className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}>
                              <Play size={14} /> Resume Diagnostic Assessment
                            </button>
                          ) : (
                            <button onClick={() => handleStartOrResumeAssessment(ass._id)} className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}>
                              <Play size={14} /> Start Diagnostic Assessment
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: MY LEARNING PATHS */}
          {(activeTab === 'learning' || activeTab === 'all') && (
            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                  <PathIcon size={20} color="#FF8A00" /> My Learning Paths ({learningPaths.length})
                </h2>
                <Link to="/student/learning-paths" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                  View All Learning Paths <ArrowRight size={12} />
                </Link>
              </div>

              {learningPaths.length === 0 ? (
                <div className="card" style={{ padding: '36px', textAlign: 'center', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <PathIcon size={32} color="#808080" style={{ marginBottom: '12px' }} />
                  <p style={{ color: '#B3B3B3', margin: 0 }}>Complete a diagnostic assessment to generate your personalized learning path.</p>
                </div>
              ) : (
                <div className="grid-3">
                  {learningPaths.map((path) => {
                    const totalAct = path.activities?.length || 0;
                    const completedAct = path.activities?.filter((ac) => ac.completed)?.length || 0;
                    const pct = totalAct > 0 ? Math.round((completedAct / totalAct) * 100) : 0;

                    return (
                      <div key={path._id} className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            {path.isMastered ? (
                              <span className="badge badge-success" style={{ color: '#FFFFFF' }}>Topic Mastered</span>
                            ) : path.isReadyForReassessment ? (
                              <span className="badge badge-success" style={{ color: '#FFFFFF' }}>Reassessment Ready</span>
                            ) : (
                              <span className="badge badge-warning">Active Learning</span>
                            )}
                            <span style={{ fontSize: '0.8rem', color: '#FF8A00', fontWeight: 600 }}>{pct}% Complete</span>
                          </div>

                          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#FFFFFF' }}>
                            {path.topicId?.title || 'Personalized Pathway'}
                          </h4>

                          <div className="progress-bar-track" style={{ width: '100%', height: '6px', background: '#2A2A2A', marginBottom: '16px' }}>
                            <div className={path.isMastered || pct === 100 ? 'progress-bar-fill-success' : 'progress-bar-fill'} style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        <Link to={`/student/learning-paths/${path._id}`} className="btn btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }}>
                          Continue Learning Path <ArrowRight size={14} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: RECENT PROGRESS */}
          {(activeTab === 'progress' || activeTab === 'all') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                  <TrendingUp size={20} color="#FF8A00" /> Progress & Improvement Reports
                </h2>
                <Link to="/student/progress" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                  Full Progress Page <ArrowRight size={12} />
                </Link>
              </div>

              {recentComparison ? (
                <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span className="badge badge-orange">Progress Analysis</span>
                    <span className="badge badge-success" style={{ color: '#FFFFFF' }}>Reassessment Evaluated</span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px', color: '#FFFFFF' }}>
                    Latest Progress & Improvement Report
                  </h3>

                  {recentComparison.summary && (
                    <p style={{ color: '#B3B3B3', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '20px' }}>
                      {recentComparison.summary}
                    </p>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    <div style={{ padding: '14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                      <span style={{ fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        ✓ Improved Concepts ({recentComparison.improvedConcepts?.length || 0})
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#B3B3B3' }}>
                        {recentComparison.improvedConcepts?.join(', ') || 'None recorded yet'}
                      </span>
                    </div>

                    <div style={{ padding: '14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                      <span style={{ fontSize: '0.85rem', color: '#F59E0B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        ! Remaining Weaknesses ({recentComparison.unchangedWeaknesses?.length || 0})
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#B3B3B3' }}>
                        {recentComparison.unchangedWeaknesses?.join(', ') || 'No remaining weaknesses!'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: '36px', textAlign: 'center', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <Compass size={36} color="#808080" style={{ marginBottom: '12px' }} />
                  <p style={{ color: '#B3B3B3', margin: 0 }}>Complete a reassessment after taking your learning path to see your improvement comparison.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
