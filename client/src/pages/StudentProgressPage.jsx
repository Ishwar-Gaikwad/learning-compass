import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { assessmentService } from '../services/assessment.service';
import { learningPathService } from '../services/learningPath.service';
import { reassessmentService } from '../services/reassessment.service';
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  BookOpen,
  Compass
} from 'lucide-react';

export const StudentProgressPage = () => {
  const { user } = useAuth();

  const [assessments, setAssessments] = useState([]);
  const [learningPaths, setLearningPaths] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProgressData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [assessmentsData, pathsData] = await Promise.all([
        assessmentService.getStudentAssessments().catch((err) => {
          console.warn('Failed to fetch assessments for progress:', err);
          return [];
        }),
        learningPathService.getStudentLearningPaths().catch((err) => {
          console.warn('Failed to fetch learning paths for progress:', err);
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
            setComparison(compData);
          }
        } catch (compErr) {
          console.info('No comparison report available for attempt:', submittedAssessment.attemptId);
        }
      }
    } catch (err) {
      console.error('Progress page loading failed:', err);
      setError(err.message || 'Unable to load progress analysis data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgressData();
  }, []);

  const completedAssessments = assessments.filter(
    (a) => a.userAttemptStatus === 'submitted' || a.userAttemptStatus === 'evaluated'
  );

  const activeLearningPaths = learningPaths.filter(
    (p) => p.status === 'active' && !p.isMastered
  );

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
            <TrendingUp color="#FF8A00" size={26} />
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: '#FFFFFF' }}>
              Diagnostic & Learning Progress
            </h1>
          </div>
          <p style={{ margin: 0, color: '#B3B3B3', fontSize: '0.95rem' }}>
            Personalized mastery metrics, concept improvement analysis, and progress tracking for <strong style={{ color: '#FFFFFF' }}>{user?.name || 'Student'}</strong>.
          </p>
        </div>

        <button
          onClick={fetchProgressData}
          className="btn btn-secondary"
          disabled={isLoading}
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh Progress
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
          <button onClick={fetchProgressData} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} className="card" style={{ padding: '24px', borderRadius: '12px', height: '160px', opacity: 0.6, background: '#121212', border: '1px solid #2A2A2A' }}>
              <div style={{ width: '60%', height: '18px', background: '#2A2A2A', borderRadius: '4px', marginBottom: '16px' }} />
              <div style={{ width: '80%', height: '12px', background: '#2A2A2A', borderRadius: '4px', marginBottom: '24px' }} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary Metric Counters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '36px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
              <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '6px' }}>Completed Assessments</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FF8A00' }}>{completedAssessments.length}</div>
              <span style={{ fontSize: '0.8rem', color: '#808080' }}>Out of {assessments.length} total assessments</span>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
              <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '6px' }}>Active Learning Paths</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FF8A00' }}>{activeLearningPaths.length}</div>
              <span style={{ fontSize: '0.8rem', color: '#808080' }}>Active learning paths</span>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
              <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '6px' }}>Improved Concepts</span>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FFFFFF' }}>
                {comparison?.improvedConcepts?.length || 0}
              </div>
              <span style={{ fontSize: '0.8rem', color: '#808080' }}>Mastery recoveries recorded</span>
            </div>
          </div>

          {/* Completed Assessment Diagnostic Results Section */}
          <div className="card" style={{ padding: '28px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A', marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#FFFFFF' }}>
                <CheckCircle2 size={22} color="#22C55E" /> Assessment Results & Diagnostic Reports ({completedAssessments.length})
              </h2>
            </div>

            {completedAssessments.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#B3B3B3', background: '#1A1A1A', borderRadius: '8px', border: '1px solid #2A2A2A' }}>
                <BookOpen size={32} color="#808080" style={{ marginBottom: '12px' }} />
                <p style={{ margin: 0 }}>No completed diagnostic assessments yet. Start an assessment to view diagnostic results.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {completedAssessments.map((ass) => {
                  const matchingPath = learningPaths.find(
                    (p) => p.topicId?._id === ass.topicId?._id || p.topicId === ass.topicId?._id
                  );
                  const isMastered = matchingPath?.isMastered || matchingPath?.status === 'completed';

                  return (
                    <div
                      key={ass._id}
                      style={{
                        padding: '20px',
                        borderRadius: '10px',
                        background: '#1A1A1A',
                        border: '1px solid #2A2A2A',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          {isMastered ? (
                            <span className="badge badge-success" style={{ color: '#FFFFFF' }}>Topic Mastered</span>
                          ) : (
                            <span className="badge badge-success" style={{ color: '#FFFFFF' }}>Completed</span>
                          )}
                          <span style={{ fontSize: '0.8rem', color: '#B3B3B3' }}>
                            {ass.submittedAt ? new Date(ass.submittedAt).toLocaleDateString() : 'Submitted'}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 6px 0' }}>
                          {ass.title}
                        </h3>
                        <p style={{ color: '#B3B3B3', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
                          {ass.topicId?.title ? `Topic: ${ass.topicId.title}` : 'Diagnostic Assessment'}
                        </p>

                        {isMastered && (
                          <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.12)', color: '#FFFFFF', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={16} color="#22C55E" /> 100% Mastery Achieved • All Objectives Met
                          </div>
                        )}
                      </div>

                      {matchingPath ? (
                        <Link
                          to={`/student/learning-paths/${matchingPath._id}`}
                          className="btn btn-secondary"
                          style={{ width: '100%', padding: '8px', fontSize: '0.85rem', textDecoration: 'none', textAlign: 'center' }}
                        >
                          {isMastered ? 'View Mastery Report' : 'View Learning Path'}
                        </Link>
                      ) : (
                        <Link
                          to="/student/learning-paths"
                          className="btn btn-secondary"
                          style={{ width: '100%', padding: '8px', fontSize: '0.85rem', textDecoration: 'none', textAlign: 'center' }}
                        >
                          View Learning Paths
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diagnostic Comparison Analysis */}
          {comparison ? (
            <div className="card" style={{ padding: '28px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A', marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>Progress & Improvement Analysis</span>
                <span className="badge badge-success" style={{ fontSize: '0.75rem', color: '#FFFFFF' }}>Reassessment Evaluated</span>
              </div>

              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 16px 0', color: '#FFFFFF' }}>
                Latest Reassessment Improvement Report
              </h2>

              {comparison.summary && (
                <div style={{ padding: '14px 18px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#B3B3B3', marginBottom: '24px', lineHeight: 1.5, fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#FF8A00', marginBottom: '4px' }}>
                    <Sparkles size={15} color="#FF8A00" /> Progress Summary
                  </div>
                  {comparison.summary}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                {/* Improved Concepts */}
                <div className="card" style={{ padding: '18px', borderRadius: '10px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#FFFFFF', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color="#22C55E" /> Improved Concepts ({comparison.improvedConcepts?.length || 0})
                  </h3>
                  {comparison.improvedConcepts?.length === 0 ? (
                    <p style={{ color: '#808080', fontSize: '0.85rem', margin: 0 }}>No concepts showed full recovery yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {comparison.improvedConcepts?.map((c, idx) => (
                        <div key={idx} style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.12)', color: '#FFFFFF', fontSize: '0.85rem', fontWeight: 600 }}>
                          ✓ {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remaining Weak Concepts */}
                <div className="card" style={{ padding: '18px', borderRadius: '10px', background: '#121212', border: '1px solid #2A2A2A' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#F59E0B', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} color="#F59E0B" /> Remaining Weak Concepts ({comparison.unchangedWeaknesses?.length || 0})
                  </h3>
                  {comparison.unchangedWeaknesses?.length === 0 ? (
                    <p style={{ color: '#808080', fontSize: '0.85rem', margin: 0 }}>No remaining weak concepts!</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {comparison.unchangedWeaknesses?.map((c, idx) => (
                        <div key={idx} style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', fontSize: '0.85rem', fontWeight: 500 }}>
                          ! {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '44px 24px', textAlign: 'center', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A', marginBottom: '40px' }}>
              <Compass size={40} color="#808080" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#FFFFFF' }}>No Diagnostic Comparisons Generated</h3>
              <p style={{ color: '#B3B3B3', maxWidth: '480px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
                Complete a diagnostic assessment and take a targeted reassessment after following your learning path to track your improvement.
              </p>
              <Link to="/student/assessments" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={15} /> Explore Available Assessments
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
};
