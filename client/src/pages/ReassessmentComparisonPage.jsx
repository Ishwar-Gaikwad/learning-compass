import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reassessmentService } from '../services/reassessment.service';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Award,
  Zap,
  RefreshCw,
  Check
} from 'lucide-react';

export const ReassessmentComparisonPage = () => {
  const { attemptId } = useParams();

  const [comparison, setComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchComparison = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reassessmentService.getReassessmentComparison(attemptId);
      setComparison(data);
    } catch (err) {
      console.error('[ReassessmentComparisonPage] Load failed:', err);
      setError(err.message || 'Unable to load diagnostic progress comparison.');
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const formatDelta = (val) => {
    if (typeof val !== 'number') return '0%';
    const pct = val <= 1 && val >= -1 ? Math.round(val * 100) : Math.round(val);
    if (pct > 0) return `+${pct}%`;
    return `${pct}%`;
  };

  const renderDeltaBadge = (val) => {
    const pct = typeof val === 'number' ? (val <= 1 && val >= -1 ? Math.round(val * 100) : Math.round(val)) : 0;
    if (pct > 0) {
      return (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#FFFFFF' }}>
          <TrendingUp size={13} color="#22C55E" /> {formatDelta(val)}
        </span>
      );
    }
    if (pct < 0) {
      return (
        <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
          <TrendingDown size={13} color="#EF4444" /> {formatDelta(val)}
        </span>
      );
    }
    return (
      <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
        <Minus size={13} /> 0% Change
      </span>
    );
  };

  const getMasteryBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'mastered':
        return <span className="badge badge-success" style={{ color: '#FFFFFF' }}>Mastered</span>;
      case 'proficient':
        return <span className="badge badge-orange">Proficient</span>;
      case 'developing':
        return <span className="badge badge-warning">Developing</span>;
      case 'novice':
      default:
        return <span className="badge badge-error">Novice</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px', borderRadius: '12px', maxWidth: '500px', margin: '0 auto', background: '#121212', border: '1px solid #2A2A2A' }}>
          <RefreshCw className="spin" size={36} color="#FF8A00" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#FFFFFF' }}>Loading Diagnostic Progress Comparison...</h3>
          <p style={{ margin: 0, color: '#B3B3B3' }}>Analyzing progress between initial assessment and reassessment.</p>
        </div>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="container" style={{ padding: '60px 20px' }}>
        <div className="card" style={{ padding: '40px', borderRadius: '12px', maxWidth: '600px', margin: '0 auto', textAlign: 'center', background: '#121212', border: '1px solid #EF4444' }}>
          <AlertCircle size={48} color="#EF4444" style={{ marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.4rem', color: '#FFFFFF' }}>Comparison Not Available</h3>
          <p style={{ color: '#B3B3B3', marginBottom: '24px', lineHeight: 1.6 }}>
            {error || 'Reassessment diagnostic comparison data could not be loaded.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/student/learning-paths" className="btn btn-secondary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> Back to My Learning Paths
            </Link>
            <button onClick={fetchComparison} className="btn btn-primary" style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const prevReport = comparison.previousDiagnosticReportId || {};
  const newReport = comparison.newDiagnosticReportId || {};

  return (
    <div className="container" style={{ padding: '30px 20px 60px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <Link to="/student/learning-paths" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#B3B3B3', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to My Learning Paths
        </Link>
      </div>

      {/* Header Context Card */}
      <div className="card" style={{ padding: '28px', borderRadius: '12px', marginBottom: '32px', background: '#121212', border: '1px solid #2A2A2A' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-orange" style={{ fontSize: '0.75rem' }}>Diagnostic Comparison</span>
          <span className="badge badge-success" style={{ fontSize: '0.75rem', color: '#FFFFFF' }}>Reassessment Progress</span>
        </div>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '1.6rem', fontWeight: 700, color: '#FFFFFF' }}>
          Reassessment Diagnostic Progress Report
        </h1>

        {/* Analytical Summary */}
        {comparison.summary && (
          <div style={{ padding: '14px 18px', borderRadius: '8px', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#B3B3B3', fontSize: '0.9rem', lineHeight: 1.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 600, color: '#FF8A00' }}>
              <Sparkles size={15} color="#FF8A00" /> Progress Summary
            </div>
            {comparison.summary}
          </div>
        )}
      </div>

      {/* 1. SIDE-BY-SIDE OVERALL PERFORMANCE COMPARISON */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
        <Award size={18} color="#FF8A00" /> Overall Performance Growth
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Previous Initial Diagnosis */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '6px' }}>
            Previous Diagnosis (Initial)
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#B3B3B3', marginBottom: '8px' }}>
            {prevReport.overallMasteryScore !== undefined ? `${prevReport.overallMasteryScore}%` : 'N/A'}
          </div>
          <div>{getMasteryBadge(prevReport.masteryLevel)}</div>
        </div>

        {/* New Reassessment Diagnosis */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600 }}>
              New Reassessment Diagnosis
            </span>
            {renderDeltaBadge(comparison.overallScoreDelta)}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
            {newReport.overallMasteryScore !== undefined ? `${newReport.overallMasteryScore}%` : 'N/A'}
          </div>
          <div>{getMasteryBadge(newReport.masteryLevel)}</div>
        </div>
      </div>

      {/* 2. DIMENSIONAL SKILL IMPROVEMENT */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
        <TrendingUp size={18} color="#FF8A00" /> Skill Improvement Across Dimensions
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '36px' }}>
        {/* Conceptual Understanding Delta */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '8px' }}>
            Conceptual Understanding Change
          </span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>
              {formatDelta(comparison.conceptualDelta)}
            </span>
            {renderDeltaBadge(comparison.conceptualDelta)}
          </div>
        </div>

        {/* Procedural Fluency Delta */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '8px' }}>
            Procedural Fluency Change
          </span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>
              {formatDelta(comparison.proceduralDelta)}
            </span>
            {renderDeltaBadge(comparison.proceduralDelta)}
          </div>
        </div>

        {/* Application & Transfer Delta */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <span style={{ fontSize: '0.85rem', color: '#B3B3B3', display: 'block', marginBottom: '8px' }}>
            Application & Transfer Change
          </span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFFFFF' }}>
              {formatDelta(comparison.applicationDelta)}
            </span>
            {renderDeltaBadge(comparison.applicationDelta)}
          </div>
        </div>
      </div>

      {/* 3. CONCEPT MASTERY SHIFT LISTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Improved Concepts */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#22C55E" /> Improved Concepts ({comparison.improvedConcepts?.length || 0})
          </h3>
          {comparison.improvedConcepts?.length === 0 ? (
            <p style={{ color: '#808080', fontSize: '0.85rem', margin: 0 }}>No concepts showed full recovery yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {comparison.improvedConcepts?.map((c, idx) => (
                <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.10)', color: '#FFFFFF', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="#22C55E" /> {c}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unchanged Weaknesses */}
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} color="#F59E0B" /> Remaining Weak Concepts ({comparison.unchangedWeaknesses?.length || 0})
          </h3>
          {comparison.unchangedWeaknesses?.length === 0 ? (
            <p style={{ color: '#808080', fontSize: '0.85rem', margin: 0 }}>No remaining weak concepts!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {comparison.unchangedWeaknesses?.map((c, idx) => (
                <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.10)', color: '#F59E0B', fontSize: '0.85rem', fontWeight: 500 }}>
                  ! {c}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Newly Observed Weaknesses */}
        {comparison.newlyObservedWeaknesses?.length > 0 && (
          <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} color="#EF4444" /> Newly Observed Weaknesses ({comparison.newlyObservedWeaknesses.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {comparison.newlyObservedWeaknesses.map((c, idx) => (
                <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.10)', color: '#EF4444', fontSize: '0.85rem', fontWeight: 500 }}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. REMAINING MISCONCEPTIONS */}
      {comparison.remainingMisconceptions?.length > 0 && (
        <div className="card" style={{ padding: '20px', borderRadius: '12px', background: '#121212', border: '1px solid #2A2A2A' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} color="#F59E0B" /> Remaining Misconceptions
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {comparison.remainingMisconceptions.map((m, idx) => (
              <span key={idx} className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
