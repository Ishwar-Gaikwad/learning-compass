import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, AlertCircle, Loader2 } from 'lucide-react';

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const regUser = await register({ name, email, password, role });
      if (regUser?.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      if (err.status === 400 || err.status === 409 || err.code === 'USER_EXISTS' || err.message?.toLowerCase().includes('already exists') || err.message?.toLowerCase().includes('registered')) {
        setErrorMessage('An account with this email address already exists. Please sign in instead.');
      } else if (err.code === 'NETWORK_ERROR') {
        setErrorMessage('Unable to connect to the registration server. Please check your internet connection.');
      } else {
        setErrorMessage(err.message || 'An unexpected error occurred during registration. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', textAlign: 'center', color: '#ffffff' }}>Create Account</h2>
      <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '28px' }}>
        Join Learning Compass as a Student or Teacher
      </p>

      {errorMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          background: '#000000',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          color: '#ffffff',
          fontSize: '0.875rem',
          marginBottom: '20px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} color="#ffffff" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Full Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            required
            style={{ background: '#000000', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Email Address</label>
          <input
            type="email"
            className="form-input"
            placeholder="user@school.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
            style={{ background: '#000000', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            required
            style={{ background: '#000000', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Account Role</label>
          <select
            className="form-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSubmitting}
            style={{ backgroundColor: '#000000', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.2)' }}
          >
            <option value="student" style={{ background: '#000000', color: '#ffffff' }}>Student</option>
            <option value="teacher" style={{ background: '#000000', color: '#ffffff' }}>Teacher</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '12px' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="spin" color="#000000" /> Creating Account...
            </>
          ) : (
            <>
              <UserPlus size={18} /> Register
            </>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.65)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ fontWeight: 600, color: '#ffffff' }}>Sign in</Link>
      </p>
    </div>
  );
};
