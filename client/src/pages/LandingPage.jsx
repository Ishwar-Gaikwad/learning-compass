import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { Sparkles, Brain, Cpu, BookOpen, ArrowRight, LayoutDashboard, User } from 'lucide-react';

export const LandingPage = () => {
  const { user, loading, isLoading } = useAuth();
  const isAuthLoading = loading ?? isLoading;

  const dashboardPath = user?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';

  return (
    <div>
      {/* Hero Section */}
      <section style={{
        padding: '90px 0 70px 0',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div className="container">
          <span className="badge badge-orange" style={{ marginBottom: '20px', padding: '5px 14px' }}>
            <Sparkles size={14} style={{ display: 'inline', marginRight: '6px' }} color="#FF8A00" /> Next-Generation Adaptive Education
          </span>

          <h1 style={{
            fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)',
            lineHeight: 1.15,
            maxWidth: '900px',
            margin: '0 auto 20px auto',
            color: '#FFFFFF',
            fontWeight: 700
          }}>
            Master Complex Subjects with <span style={{ color: '#FF8A00' }}>AI-Powered</span> Personalized Learning
          </h1>

          <p style={{
            fontSize: '1.15rem',
            color: '#B3B3B3',
            maxWidth: '700px',
            margin: '0 auto 36px auto',
            lineHeight: 1.6
          }}>
            Learning Compass turns your course materials into personalized assessments, identifies learning gaps, and creates targeted learning paths for every student.
          </p>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', minHeight: '48px', alignItems: 'center' }}>
            {isAuthLoading ? (
              <span style={{ fontSize: '0.9rem', color: '#888888', fontStyle: 'italic' }}>
                Checking login status...
              </span>
            ) : user ? (
              <>
                <Link to={dashboardPath} className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <LayoutDashboard size={16} /> Go to Dashboard
                </Link>
                <Link to={user?.role === 'teacher' ? '/teacher/profile' : '/student/profile'} className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} /> View Profile
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
                  Start Learning Journey <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: '0.95rem' }}>
                  Sign In to Portal
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Core Feature Grid */}
      <section style={{ padding: '50px 0 80px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '10px', color: '#FFFFFF' }}>AI-Powered Learning Journey</h2>
            <p style={{ color: '#B3B3B3' }}>Helping teachers understand learning and helping students improve.</p>
          </div>

          <div className="grid-3">
            <div className="card" style={{ padding: '28px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(255, 138, 0, 0.12)',
                border: '1px solid rgba(255, 138, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px'
              }}>
                <BookOpen color="#FF8A00" size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#FFFFFF' }}>1. Learn From Your Materials</h3>
              <p style={{ color: '#B3B3B3', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Upload course PDFs and materials. Learning Compass understands the content and prepares assessments from it.
              </p>
            </div>

            <div className="card" style={{ padding: '28px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(255, 138, 0, 0.12)',
                border: '1px solid rgba(255, 138, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px'
              }}>
                <Brain color="#FF8A00" size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#FFFFFF' }}>2. Understand Student Learning</h3>
              <p style={{ color: '#B3B3B3', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Assess conceptual understanding, problem-solving ability, and the ability to apply knowledge.
              </p>
            </div>

            <div className="card" style={{ padding: '28px', background: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: 'rgba(255, 138, 0, 0.12)',
                border: '1px solid rgba(255, 138, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px'
              }}>
                <Cpu color="#FF8A00" size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', color: '#FFFFFF' }}>3. Personalized Improvement</h3>
              <p style={{ color: '#B3B3B3', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Identify weak areas, create targeted learning tasks, and reassess students to track improvement.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

