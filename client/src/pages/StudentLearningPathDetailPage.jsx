import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { learningPathService } from '../services/learningPath.service';
import { reassessmentService } from '../services/reassessment.service';
import {
  ArrowLeft,
  CheckCircle2,
  Layers,
  AlertCircle,
  RefreshCw,
  Award,
  FileText,
  Target,
  Play
} from 'lucide-react';

export const StudentLearningPathDetailPage = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();

  const [learningPath, setLearningPath] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completingNodeId, setCompletingNodeId] = useState(null);
  const [isGeneratingReassessment, setIsGeneratingReassessment] = useState(false);

  const fetchPathDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await learningPathService.getLearningPathById(pathId);
      setLearningPath(data);
    } catch (err) {
      console.error('Failed to fetch learning path detail:', err);
      setError(err.message || 'Unable to load learning path details.');
    } finally {
      setIsLoading(false);
    }
  }, [pathId]);

  useEffect(() => {
    fetchPathDetails();
  }, [fetchPathDetails]);

  const handleToggleNodeComplete = async (nodeId) => {
    if (completingNodeId || !learningPath) return;

    setCompletingNodeId(nodeId);
    try {
      const updatedPath = await learningPathService.completeNode(learningPath._id, nodeId);
      setLearningPath(updatedPath);
    } catch (err) {
      console.error('Failed to update node completion:', err);
      alert(err.message || 'Failed to update activity completion status.');
    } finally {
      setCompletingNodeId(null);
    }
  };

  const handleStartReassessment = async () => {
    if (!learningPath?.diagnosticReportId || isGeneratingReassessment) return;

    setIsGeneratingReassessment(true);
    try {
      const res = await reassessmentService.generateReassessment(learningPath.diagnosticReportId);
      if (res && res.reassessment) {
        navigate(`/student/reassessments/${res.reassessment._id}`);
      }
    } catch (err) {
      console.error('Failed to generate targeted reassessment:', err);
      alert(err.message || 'Unable to generate targeted reassessment. Please try again.');
    } finally {
      setIsGeneratingReassessment(false);
    }
  };

  const getDifficultyBadge = (difficulty) => {
    return <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>{difficulty || 'Medium'}</span>;
  };

  const getNodeTypeBadge = (type) => {
    switch (type) {
      case 'remedial_reading':
        return <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>Remedial Reading</span>;
      case 'concept_explanation':
        return <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>Concept Explanation</span>;
      case 'checkpoint_quiz':
        return <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Checkpoint Quiz</span>;
      case 'practice_exercise':
      default:
        return <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>Practice Exercise</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px', borderRadius: '12px', maxWidth: '500px', margin: '0 auto', background: '#121212', border: '1px solid #2A2A2A' }}>
          <RefreshCw className="spin" size={36} color="#FF8A00" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#FFFFFF' }}>Loading Learning Path...</h3>
          <p style={{ margin: 0, color: '#B3B3B3' }}>Retrieving personalized activities and recommendations.</p>
        </div>
      </div>
    );
  }

  if (error || !learningPath) {
    return (
      <div className="container" style={{ padding: '60px 20px' }}>
        <div className="card" style={{ padding: '40px', borderRadius: '12px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', background: '#121212', border: '1px solid #2A2A2A' }}>
          <AlertCircle size={48} color="#EF4444" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.4rem', color: '#FFFFFF' }}>Unable to Open Learning Path</h3>
          <p style={{ color: '#B3B3B3', marginBottom: '24px', lineHeight: 1.6 }}>
            {error || 'Learning path not found.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/student/learning-paths" className="btn btn-secondary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> Back to My Learning Paths
            </Link>
            <button onClick={fetchPathDetails} className="btn btn-primary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const topicObj = learningPath.topicId;
  const nodes = learningPath.nodes || [];
  const completedNodes = nodes.filter((n) => n.isCompleted);
  const pendingNodes = nodes.filter((n) => !n.isCompleted);
  const pct = learningPath.overallProgressPercentage || 0;
  const reassessmentStatus = learningPath.reassessmentStatus || 'not_created';
  const isMastered = learningPath.status === 'completed' || Boolean(learningPath.isMastered) || reassessmentStatus === 'mastered';
  const isReadyForReassessment = !isMastered && Boolean(learningPath.isReadyForReassessment) && reassessmentStatus !== 'completed';

  const currentPendingNodeId = pendingNodes[0]?.nodeId || pendingNodes[0]?._id;

  return (
    <div className="container" style={{ padding: '30px 20px 60px' }}>
      {/* Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Link to="/student/learning-paths" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to My Learning Paths
        </Link>
      </div>

      {/* STATE 1: TOPIC MASTERY ACHIEVED */}
      {isMastered && (
        <div style={{
          padding: '20px 24px',
          borderRadius: '12px',
          background: '#121212',
          border: '1px solid #2A2A2A',
          color: '#FFFFFF',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Award size={32} color="#22C55E" />
            <div>
              <strong style={{ fontSize: '1.15rem', display: 'block', color: '#FFFFFF' }}>Topic Mastery Achieved!</strong>
              <span style={{ fontSize: '0.875rem', color: '#B3B3B3' }}>
                Congratulations! Your performance demonstrates complete mastery of all targeted learning objectives for this topic.
              </span>
            </div>
          </div>
          <span style={{
            padding: '6px 14px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            background: 'rgba(34, 197, 94, 0.10)',
            color: '#FFFFFF',
            border: '1px solid #2A2A2A',
            borderRadius: '9999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <CheckCircle2 size={14} color="#22C55E" /> TOPIC MASTERED
          </span>
        </div>
      )}

      {/* STATE 2: REASSESSMENT COMPLETED */}
      {!isMastered && reassessmentStatus === 'completed' && (
        <div style={{
          padding: '20px 24px',
          borderRadius: '12px',
          background: '#121212',
          border: '1px solid #2A2A2A',
          color: '#FFFFFF',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle2 size={28} color="#22C55E" />
            <div>
              <strong style={{ fontSize: '1.1rem', display: 'block', color: '#FFFFFF' }}>Targeted Reassessment Completed</strong>
              <span style={{ fontSize: '0.875rem', color: '#B3B3B3' }}>
                Your targeted reassessment has been submitted and evaluated. Check your Progress page for your results.
              </span>
            </div>
          </div>
          <span className="badge badge-success" style={{ padding: '6px 14px', fontSize: '0.75rem', color: '#FFFFFF' }}>
            Reassessment Completed
          </span>
        </div>
      )}

      {/* STATE 3: READY FOR REASSESSMENT */}
      {!isMastered && isReadyForReassessment && reassessmentStatus !== 'completed' && (
        <div style={{
          padding: '20px 24px',
          borderRadius: '12px',
          background: '#121212',
          border: '1px solid #2A2A2A',
          color: '#FFFFFF',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Award size={28} color="#FF8A00" />
            <div>
              <strong style={{ fontSize: '1.1rem', display: 'block', color: '#FFFFFF' }}>Reassessment Readiness Achieved!</strong>
              <span style={{ fontSize: '0.875rem', color: '#B3B3B3' }}>
                You have completed 100% of your required learning activities for this topic. Click below to take your targeted reassessment.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleStartReassessment}
              disabled={isGeneratingReassessment}
              className="btn btn-primary"
              style={{ padding: '10px 18px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {isGeneratingReassessment ? <RefreshCw className="spin" size={16} /> : <Play size={16} />}
              Start Targeted Reassessment
            </button>
          </div>
        </div>
      )}

      {/* 1. LEARNING PATH OVERVIEW */}
      <div className="card" style={{ padding: '28px', borderRadius: '12px', marginBottom: '32px', background: '#121212', border: '1px solid #2A2A2A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>Personalized Learning Path</span>
              {topicObj?.title && (
                <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={14} color="#FF8A00" /> {topicObj.title}
                </span>
              )}
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.6rem', fontWeight: 700, color: '#FFFFFF' }}>
              {learningPath.title}
            </h1>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '4px' }}>
              Overall Progress
            </span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF' }}>
              {pct}% ({completedNodes.length}/{nodes.length} Completed)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar-track" style={{ width: '100%', height: '8px', background: '#2A2A2A' }}>
          <div className={isMastered || pct === 100 ? 'progress-bar-fill-success' : 'progress-bar-fill'} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* 2. PENDING ACTIVITIES (Current Focus) */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#FFFFFF' }}>
          <Target size={20} color="#FF8A00" /> Pending Learning Activities ({pendingNodes.length})
        </h2>

        {pendingNodes.length === 0 ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
            <CheckCircle2 size={36} color="#22C55E" style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 6px 0', color: '#FFFFFF' }}>All Activities Completed!</h4>
            <p style={{ margin: 0, color: '#B3B3B3', fontSize: '0.9rem' }}>
              Great job! You have finished every practice activity and explanation on this learning path.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {pendingNodes.map((node) => {
              const nodeId = node.nodeId || node._id;
              const isCurrent = nodeId === currentPendingNodeId;

              return (
                <div
                  key={nodeId}
                  className="card"
                  style={{
                    padding: '24px',
                    borderRadius: '12px',
                    background: '#121212',
                    border: '1px solid #2A2A2A',
                    position: 'relative'
                  }}
                >
                  {isCurrent && (
                    <span className="badge badge-orange" style={{ position: 'absolute', top: '16px', right: '16px', fontSize: '0.75rem' }}>
                      Current Focus Activity
                    </span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(255, 138, 0, 0.12)',
                      color: '#FF8A00',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.85rem'
                    }}>
                      #{node.sequenceOrder || 1}
                    </span>
                    {getNodeTypeBadge(node.type)}
                    {getDifficultyBadge(node.difficulty)}
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 8px 0', color: '#FFFFFF' }}>
                    {node.title}
                  </h3>

                  {/* Learning Target & Reason */}
                  <div style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: '#1A1A1A',
                    border: '1px solid #2A2A2A',
                    marginBottom: '16px',
                    fontSize: '0.875rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div>
                      <strong style={{ color: '#FF8A00' }}>Target Weak Concept:</strong> <span style={{ color: '#FFFFFF' }}>{node.targetConcept}</span>
                    </div>
                    <div>
                      <strong style={{ color: '#B3B3B3' }}>Reason Identified:</strong> <span style={{ color: '#B3B3B3' }}>{node.reasonForTargeting}</span>
                    </div>
                    <div>
                      <strong style={{ color: '#FFFFFF' }}>Learning Objective:</strong> <span style={{ color: '#B3B3B3' }}>{node.learningObjective}</span>
                    </div>
                  </div>

                  {/* Recommended Teacher Material */}
                  {node.recommendedMaterial?.fileName && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: '#1A1A1A',
                      border: '1px solid #2A2A2A',
                      marginBottom: '16px',
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FF8A00', fontWeight: 600, marginBottom: '4px' }}>
                        <FileText size={14} color="#FF8A00" /> Recommended Teacher Material
                      </div>
                      <div style={{ color: '#FFFFFF', fontWeight: 500 }}>
                        {node.recommendedMaterial.fileName} {node.recommendedMaterial.pageNumber ? `(Page ${node.recommendedMaterial.pageNumber})` : ''}
                      </div>
                      {node.recommendedMaterial.excerpt && (
                        <p style={{ margin: '4px 0 0 0', color: '#808080', fontStyle: 'italic', fontSize: '0.8rem' }}>
                          "{node.recommendedMaterial.excerpt}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Practice Activity Detail */}
                  {node.practiceActivity && (
                    <div style={{ marginBottom: '16px', fontSize: '0.9rem', color: '#B3B3B3', lineHeight: 1.5 }}>
                      <strong style={{ color: '#FFFFFF' }}>Practice Activity:</strong> {node.practiceActivity.description || node.practiceActivity.title}
                    </div>
                  )}

                  {/* Expected Outcome */}
                  {node.expectedOutcome && (
                    <div style={{ marginBottom: '20px', fontSize: '0.85rem', color: '#808080' }}>
                      <strong style={{ color: '#B3B3B3' }}>Expected Outcome:</strong> {node.expectedOutcome}
                    </div>
                  )}

                  {/* Action Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleToggleNodeComplete(nodeId)}
                      disabled={completingNodeId === nodeId}
                      className="btn btn-primary"
                      style={{ padding: '10px 20px', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      {completingNodeId === nodeId ? (
                        <RefreshCw className="spin" size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Mark Activity Complete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. COMPLETED ACTIVITIES SECTION */}
      {completedNodes.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#FFFFFF' }}>
            <CheckCircle2 size={20} color="#22C55E" /> Completed Activities ({completedNodes.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {completedNodes.map((node) => {
              const nodeId = node.nodeId || node._id;

              return (
                <div
                  key={nodeId}
                  className="card"
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: '#121212',
                    border: '1px solid #2A2A2A'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <CheckCircle2 size={20} color="#22C55E" />
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#FFFFFF' }}>
                          #{node.sequenceOrder}: {node.title}
                        </h4>
                        <span style={{ fontSize: '0.8rem', color: '#B3B3B3' }}>
                          Target Concept: {node.targetConcept}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleNodeComplete(nodeId)}
                      disabled={completingNodeId === nodeId}
                      className="btn btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                    >
                      {completingNodeId === nodeId ? <RefreshCw className="spin" size={14} /> : 'Undo Completion'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
