import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { learningPathService } from '../services/learningPath.service';
import { useAuth } from '../hooks/useAuth';
import { Route as PathIcon, CheckCircle2, RefreshCw, AlertCircle, Layers, ArrowRight, Compass } from 'lucide-react';

export const StudentLearningPathListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [learningPaths, setLearningPaths] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLearningPaths = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await learningPathService.getStudentLearningPaths();
      setLearningPaths(data);
    } catch (err) {
      console.error('Failed to fetch student learning paths:', err);
      setError(err.message || 'Unable to load personalized learning paths.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningPaths();
  }, []);

  const getStatusBadge = (pathItem) => {
    if (pathItem.status === 'completed' || pathItem.isMastered || pathItem.reassessmentStatus === 'completed' || pathItem.reassessmentStatus === 'mastered') {
      return <span className="badge" style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.3)' }}>Completed</span>;
    }
    if (pathItem.isReadyForReassessment && !pathItem.isMastered) {
      return <span className="badge" style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.4)' }}>Ready for Reassessment</span>;
    }
    return <span className="badge" style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}>Active</span>;
  };

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{
        padding: '32px',
        borderRadius: '20px',
        marginBottom: '40px',
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
            <PathIcon color="#ffffff" size={24} />
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>
              My Learning Paths
            </h1>
          </div>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.65)', fontSize: '1rem' }}>
            Personalized learning paths tailored to your diagnostic assessment results.
          </p>
        </div>

        <button
          onClick={fetchLearningPaths}
          className="btn btn-secondary"
          disabled={isLoading}
          style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> Refresh
        </button>
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
            onClick={fetchLearningPaths}
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
          {[1, 2].map((n) => (
            <div key={n} className="card glass-card" style={{ padding: '24px', borderRadius: '16px', height: '200px', opacity: 0.6 }}>
              <div style={{ width: '60%', height: '20px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '6px', marginBottom: '16px' }} />
              <div style={{ width: '40%', height: '14px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '4px', marginBottom: '24px' }} />
              <div style={{ width: '100%', height: '40px', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '8px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && learningPaths.length === 0 && (
        <div className="card glass-card" style={{
          padding: '60px 20px',
          textAlign: 'center',
          borderRadius: '20px',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}>
          <Compass size={48} color="#ffffff" style={{ marginBottom: '16px', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.3rem', marginBottom: '8px', color: '#ffffff' }}>No Learning Paths Generated Yet</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.65)', maxWidth: '480px', margin: '0 auto 24px' }}>
            Complete a diagnostic assessment to generate your personalized learning path with targeted explanations and practice activities.
          </p>
        </div>
      )}

      {/* Learning Paths Grid */}
      {!isLoading && !error && learningPaths.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {learningPaths.map((pathItem) => {
            const topic = pathItem.topicId;
            const nodes = pathItem.nodes || [];
            const completedNodes = nodes.filter((n) => n.isCompleted).length;
            const totalNodes = nodes.length;
            const pct = pathItem.overallProgressPercentage || 0;

            return (
              <div
                key={pathItem._id}
                className="card glass-card"
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: '#000000',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={14} color="#ffffff" /> {topic?.title || 'Topic'}
                    </span>
                    {getStatusBadge(pathItem)}
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 12px 0', lineHeight: 1.4, color: '#ffffff' }}>
                    {pathItem.title}
                  </h3>

                  {/* Progress Info */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      <span>Progress</span>
                      <strong style={{ color: '#ffffff' }}>{pct}% ({completedNodes}/{totalNodes} Completed)</strong>
                    </div>
                    <div className="progress-bar-track" style={{ width: '100%', height: '8px' }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/student/learning-paths/${pathItem._id}`)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  View Details & Activities <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
