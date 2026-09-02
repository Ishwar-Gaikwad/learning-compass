import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { diagnosticService } from '../services/diagnostic.service';
import {
  ArrowLeft,
  Sparkles,
  Award,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Layers,
  FileText,
  AlertTriangle,
  BrainCircuit,
  Zap,
  BookOpen,
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';

export const TeacherDiagnosticReportPage = () => {
  const { attemptId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // State Management
  const [report, setReport] = useState(null);
  const [attemptData, setAttemptData] = useState(null);
  const [generationState, setGenerationState] = useState('loading'); // 'loading' | 'not_evaluated' | 'generating_report' | 'completed' | 'failed'
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  // Load report and attempt details
  const loadReportData = useCallback(async () => {
    setGenerationState('loading');
    setErrorMessage('');

    try {
      // 1. Fetch attempt and response details
      const attemptRes = await diagnosticService.getAttemptDetails(attemptId);
      setAttemptData(attemptRes);

      // 2. Fetch diagnostic report if it exists
      try {
        const reportDoc = await diagnosticService.getDiagnosticReport(attemptId);
        setReport(reportDoc);
        setGenerationState('completed');
      } catch (repErr) {
        if (repErr.status === 404 || repErr.code === 'REPORT_NOT_FOUND') {
          setGenerationState('not_evaluated');
        } else {
          throw repErr;
        }
      }
    } catch (err) {
      console.error('[TeacherDiagnosticReportPage] Load failed:', err);
      setErrorMessage(err.message || 'Failed to load student attempt or diagnostic report.');
      setGenerationState('failed');
    }
  }, [attemptId]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Resolve assessment, topic, and course identifiers
  const attempt = attemptData?.attempt;
  const resolvedAssessment = report?.assessmentId || attempt?.assessmentId;
  const resolvedAssessmentId =
    location.state?.assessmentId ||
    resolvedAssessment?._id ||
    (typeof resolvedAssessment === 'string' ? resolvedAssessment : null);

  const resolvedTopic = report?.topicId || attempt?.topicId || resolvedAssessment?.topicId;
  const resolvedTopicId =
    location.state?.topicId ||
    resolvedTopic?._id ||
    (typeof resolvedTopic === 'string' ? resolvedTopic : null);

  const resolvedCourse = report?.courseId || attempt?.courseId || resolvedAssessment?.courseId;
  const resolvedCourseId =
    location.state?.courseId ||
    resolvedCourse?._id ||
    (typeof resolvedCourse === 'string' ? resolvedCourse : null);

  // Back Navigation handler returning directly to the topic's assessment-management page
  const handleBackNavigation = () => {
    if (resolvedCourseId && resolvedTopicId) {
      navigate(`/teacher/dashboard?courseId=${resolvedCourseId}&topicId=${resolvedTopicId}`, {
        state: {
          courseId: resolvedCourseId,
          topicId: resolvedTopicId,
          assessmentId: resolvedAssessmentId
        }
      });
    } else if (resolvedAssessmentId) {
      navigate(`/teacher/dashboard?assessmentId=${resolvedAssessmentId}`, {
        state: {
          assessmentId: resolvedAssessmentId
        }
      });
    } else {
      navigate('/teacher/dashboard');
    }
  };

  // Trigger backend AI diagnostic report generation
  const handleGenerateReport = async () => {
    setGenerationState('generating_report');
    setErrorMessage('');

    try {
      const generatedReport = await diagnosticService.generateDiagnosticReport(attemptId);
      setReport(generatedReport);
      setGenerationState('completed');
    } catch (err) {
      console.error('[TeacherDiagnosticReportPage] Generation failed:', err);
      setErrorMessage(err.message || 'Diagnostic report generation failed. Please try again.');
      setGenerationState('failed');
    }
  };

  const getMasteryBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'mastered':
        return <span className="badge badge-success" style={{ fontSize: '0.75rem', color: '#FFFFFF' }}>Mastered</span>;
      case 'proficient':
        return <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>Proficient</span>;
      case 'developing':
        return <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Developing</span>;
      case 'novice':
      default:
        return <span className="badge badge-error" style={{ fontSize: '0.75rem' }}>Novice</span>;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return <span className="badge badge-error" style={{ fontSize: '0.75rem' }}>High Severity</span>;
      case 'medium':
        return <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Medium Severity</span>;
      case 'low':
      default:
        return <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>Low Severity</span>;
    }
  };

  const formatDimensionPercent = (val) => {
    if (typeof val !== 'number') return '0%';
    const pct = val <= 1 ? Math.round(val * 100) : Math.round(val);
    return `${pct}%`;
  };

  if (generationState === 'loading') {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px', borderRadius: '12px', maxWidth: '500px', margin: '0 auto', background: '#121212', border: '1px solid #2A2A2A' }}>
          <RefreshCw className="spin" size={36} color="#FF8A00" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#FFFFFF' }}>Loading Diagnostic Report...</h3>
          <p style={{ margin: 0, color: '#B3B3B3' }}>Retrieving diagnostic data from server.</p>
        </div>
      </div>
    );
  }

  if (generationState === 'generating_report') {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '44px', borderRadius: '12px', maxWidth: '550px', margin: '0 auto', background: '#121212', border: '1px solid #2A2A2A' }}>
          <BrainCircuit className="spin" size={44} color="#FF8A00" style={{ marginBottom: '18px' }} />
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', color: '#FFFFFF' }}>Generating Diagnostic Analysis...</h3>
          <p style={{ color: '#B3B3B3', lineHeight: 1.6, marginBottom: '24px', fontSize: '0.9rem' }}>
            Analyzing student responses, evaluating conceptual understanding, procedural fluency, and identifying learning gaps.
          </p>
          <div className="badge badge-orange" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px' }}>
            <Sparkles size={14} color="#FF8A00" /> Student Learning Analysis in Progress
          </div>
        </div>
      </div>
    );
  }

  if (generationState === 'failed') {
    return (
      <div className="container" style={{ padding: '60px 20px' }}>
        <div className="card" style={{ padding: '40px', borderRadius: '12px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', background: '#121212', border: '1px solid #2A2A2A' }}>
          <AlertCircle size={48} color="#EF4444" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.4rem', color: '#FFFFFF' }}>Diagnostic Report Error</h3>
          <p style={{ color: '#B3B3B3', marginBottom: '24px', lineHeight: 1.6 }}>
            {errorMessage || 'Failed to load or generate diagnostic report.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={handleBackNavigation} className="btn btn-secondary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> Back to Assessment
            </button>
            <button onClick={handleGenerateReport} className="btn btn-primary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Retry Generation
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (generationState === 'not_evaluated') {
    return (
      <div className="container" style={{ padding: '60px 20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <button onClick={handleBackNavigation} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, padding: 0 }}>
            <ArrowLeft size={16} /> Back to Assessment
          </button>
        </div>

        <div className="card" style={{ padding: '48px', borderRadius: '12px', maxWidth: '650px', margin: '0 auto', textAlign: 'center', background: '#121212', border: '1px solid #2A2A2A' }}>
          <Sparkles size={44} color="#FF8A00" style={{ marginBottom: '18px' }} />
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.4rem', color: '#FFFFFF' }}>Diagnostic Report Not Generated Yet</h3>
          <p style={{ color: '#B3B3B3', lineHeight: 1.6, marginBottom: '28px', maxWidth: '500px', margin: '0 auto 28px', fontSize: '0.95rem' }}>
            This student attempt has been submitted. Click below to generate the diagnostic report.
          </p>
          <button onClick={handleGenerateReport} className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} /> Generate Diagnostic Report
          </button>
        </div>
      </div>
    );
  }

  // COMPLETED REPORT DASHBOARD VIEW
  const responses = attemptData?.responses || [];
  const questions = attempt?.assessmentId?.questions || [];

  const studentName = report?.studentId?.name || 'Student';
  const studentEmail = report?.studentId?.email || '';
  const topicTitle = report?.topicId?.title || 'Topic';
  const assessmentTitle = report?.assessmentId?.title || 'Assessment';

  const dim = report?.dimensionScores || {};
  const conceptualPct = dim.conceptualUnderstanding !== undefined ? dim.conceptualUnderstanding : 0;
  const proceduralPct = dim.proceduralFluency !== undefined ? dim.proceduralFluency : 0;
  const applicationPct = dim.applicationTransfer !== undefined ? dim.applicationTransfer : 0;

  return (
    <div className="container" style={{ padding: '30px 20px 60px' }}>
      {/* Top Navigation & Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <button onClick={handleBackNavigation} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, padding: 0 }}>
          <ArrowLeft size={16} /> Back to Assessment
        </button>

        <button onClick={handleGenerateReport} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Re-run Diagnostic Analysis
        </button>
      </div>

      {/* Header Context Card */}
      <div className="card" style={{ padding: '28px', borderRadius: '12px', marginBottom: '28px', background: '#121212', border: '1px solid #2A2A2A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>Diagnostic Report</span>
              <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layers size={14} color="#FF8A00" /> {topicTitle}
              </span>
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.6rem', fontWeight: 700, color: '#FFFFFF' }}>
              {assessmentTitle}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', fontSize: '0.9rem' }}>
              <User size={15} color="#FF8A00" />
              <strong>Student:</strong> <span style={{ color: '#FFFFFF' }}>{studentName}</span> ({studentEmail})
            </div>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: '#B3B3B3' }}>Overall Mastery</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: '#FFFFFF'
              }}>
                {report.overallMasteryScore}%
              </div>
              {getMasteryBadge(report.masteryLevel)}
            </div>
          </div>
        </div>

        {/* AI Summary Section */}
        {report.aiSummary && (
          <div style={{
            marginTop: '20px',
            padding: '14px 18px',
            borderRadius: '8px',
            background: '#1A1A1A',
            border: '1px solid #2A2A2A',
            color: '#B3B3B3',
            fontSize: '0.9rem',
            lineHeight: 1.5
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontWeight: 600, color: '#FF8A00' }}>
              <Sparkles size={15} color="#FF8A00" /> Executive Diagnostic Summary
            </div>
            {report.aiSummary}
          </div>
        )}
      </div>

      {/* 1. THREE MAJOR DIMENSIONS SECTION */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
        <Award size={18} color="#FF8A00" /> Core Diagnostic Dimensions
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Conceptual Understanding */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF' }}>Conceptual Understanding</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FF8A00' }}>
              {formatDimensionPercent(conceptualPct)}
            </span>
          </div>
          <div className="progress-bar-track" style={{ width: '100%', height: '6px', background: '#2A2A2A', marginBottom: '12px' }}>
            <div className="progress-bar-fill" style={{ width: formatDimensionPercent(conceptualPct) }} />
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#B3B3B3', lineHeight: 1.4 }}>
            Measures grasp of key underlying principles, rules, and conceptual relationships.
          </p>
        </div>

        {/* Procedural Fluency */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF' }}>Procedural Fluency</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F59E0B' }}>
              {formatDimensionPercent(proceduralPct)}
            </span>
          </div>
          <div className="progress-bar-track" style={{ width: '100%', height: '6px', background: '#2A2A2A', marginBottom: '12px' }}>
            <div style={{ width: formatDimensionPercent(proceduralPct), height: '100%', background: '#F59E0B', borderRadius: '9999px' }} />
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#B3B3B3', lineHeight: 1.4 }}>
            {report.proceduralWeaknesses?.length > 0
              ? `${report.proceduralWeaknesses.length} procedural gap(s) identified in execution steps.`
              : 'Measures accuracy and fluidity in executing algorithmic procedures.'}
          </p>
        </div>

        {/* Application & Transfer */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF' }}>Application & Transfer</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#FFFFFF' }}>
              {formatDimensionPercent(applicationPct)}
            </span>
          </div>
          <div className="progress-bar-track" style={{ width: '100%', height: '6px', background: '#2A2A2A', marginBottom: '12px' }}>
            <div className="progress-bar-fill-success" style={{ width: formatDimensionPercent(applicationPct) }} />
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#B3B3B3', lineHeight: 1.4 }}>
            {report.applicationWeaknesses?.length > 0
              ? `${report.applicationWeaknesses.length} application gap(s) in problem-solving transfer.`
              : 'Measures ability to apply knowledge to novel context scenarios.'}
          </p>
        </div>
      </div>

      {/* 2. STRENGTHS & WEAK CONCEPTS SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Strengths */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
            <CheckCircle size={16} color="#22C55E" /> Identified Strengths ({report.strengths?.length || 0})
          </h3>
          {report.strengths?.length === 0 ? (
            <p style={{ color: '#808080', fontSize: '0.85rem', margin: 0 }}>No specific strengths tagged for this attempt.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {report.strengths?.map((item, idx) => (
                <div key={idx} style={{ padding: '10px 12px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                  <strong style={{ display: 'block', fontSize: '0.9rem', color: '#FFFFFF', marginBottom: '2px' }}>
                    {item.concept}
                  </strong>
                  <span style={{ fontSize: '0.85rem', color: '#B3B3B3', lineHeight: 1.4 }}>
                    {item.evidence}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weak Concepts */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444' }}>
            <AlertTriangle size={16} color="#EF4444" /> Deficient Concepts ({report.weakConcepts?.length || 0})
          </h3>
          {report.weakConcepts?.length === 0 ? (
            <p style={{ color: '#808080', fontSize: '0.85rem', margin: 0 }}>No conceptual weaknesses identified.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {report.weakConcepts?.map((item, idx) => (
                <div key={idx} style={{ padding: '10px 12px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#EF4444' }}>
                      {item.concept}
                    </strong>
                    {getSeverityBadge(item.severity)}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#B3B3B3', lineHeight: 1.4 }}>
                    {item.evidence}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. IDENTIFIED MISCONCEPTIONS WITH EVIDENCE */}
      <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B' }}>
          <Zap size={18} color="#F59E0B" /> Identified Misconceptions & Error Patterns ({report.identifiedMisconceptions?.length || 0})
        </h3>

        {report.identifiedMisconceptions?.length === 0 ? (
          <p style={{ color: '#808080', fontSize: '0.85rem', margin: 0 }}>No persistent misconceptions detected in this attempt.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {report.identifiedMisconceptions?.map((m, idx) => (
              <div key={idx} style={{ padding: '14px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className="badge badge-warning" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {m.misconceptionCode || 'MISCONCEPTION'}
                  </span>
                  {getSeverityBadge(m.severity)}
                </div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: '#F59E0B', fontWeight: 600 }}>
                  {m.title}
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#B3B3B3', lineHeight: 1.4 }}>
                  {m.explanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. RECOMMENDATIONS */}
      {report.recommendations?.length > 0 && (
        <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FF8A00' }}>
            <BookOpen size={18} color="#FF8A00" /> Instructional Recommendations
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#B3B3B3', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {report.recommendations.map((rec, idx) => (
              <li key={idx} style={{ marginBottom: '6px' }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. RESPONSE-LEVEL DETAILS ACCORDION */}
      <div className="card" style={{ padding: '24px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
          <FileText size={18} color="#FF8A00" /> Response-Level Breakdown ({questions.length} Questions)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {questions.map((q, idx) => {
            const resDoc = responses.find((r) => r.questionId === q._id || r.questionId === q._id?.toString());
            const evalData = resDoc?.evaluation || {};
            const isExpanded = expandedQuestionId === q._id;

            return (
              <div
                key={q._id || idx}
                style={{
                  borderRadius: '8px',
                  background: '#1A1A1A',
                  border: '1px solid #2A2A2A',
                  overflow: 'hidden'
                }}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedQuestionId(isExpanded ? null : q._id)}
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: '#FF8A00',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: '#0D0D0D',
                      fontSize: '0.8rem'
                    }}>
                      Q{idx + 1}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF' }}>
                      {q.questionText}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {evalData.score !== undefined ? (
                      <span className={`badge ${evalData.score > 0 ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '0.75rem', color: '#FFFFFF' }}>
                        Score: {evalData.score}
                      </span>
                    ) : (
                      <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>Unevaluated</span>
                    )}

                    {isExpanded ? <ChevronUp size={16} color="#FFFFFF" /> : <ChevronDown size={16} color="#FFFFFF" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ padding: '0 18px 18px 18px', borderTop: '1px solid #2A2A2A', paddingTop: '14px' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <strong style={{ fontSize: '0.8rem', color: '#808080', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                        Student's Submitted Answer:
                      </strong>
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: '#121212',
                        border: '1px solid #2A2A2A',
                        fontFamily: q.questionType === 'code' ? 'monospace' : 'inherit',
                        fontSize: '0.875rem',
                        color: '#FFFFFF'
                      }}>
                        {resDoc?.studentAnswer || '(No answer provided)'}
                      </div>
                    </div>

                    {evalData.reasoning && (
                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '0.8rem', color: '#808080', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Evaluation Feedback & Reasoning:
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#B3B3B3', lineHeight: 1.4 }}>
                          {evalData.reasoning}
                        </p>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                      {evalData.identifiedConcepts?.length > 0 && (
                        <div>
                          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Mastered Concepts: </span>
                          <span style={{ color: '#B3B3B3' }}>{evalData.identifiedConcepts.join(', ')}</span>
                        </div>
                      )}
                      {evalData.missingConcepts?.length > 0 && (
                        <div>
                          <span style={{ color: '#EF4444', fontWeight: 600 }}>Missing Concepts: </span>
                          <span style={{ color: '#B3B3B3' }}>{evalData.missingConcepts.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
