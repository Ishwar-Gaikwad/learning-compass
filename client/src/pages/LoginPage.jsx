import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogIn, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const loggedUser = await login({ email, password });
      if (loggedUser?.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      if (err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
        setErrorMessage('Invalid email or password. Please check your credentials and try again.');
      } else if (err.code === 'NETWORK_ERROR') {
        setErrorMessage('Unable to connect to the authentication server. Please check your internet connection.');
      } else {
        setErrorMessage(err.message || 'An unexpected error occurred during login. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', textAlign: 'center', color: '#ffffff' }}>Welcome Back</h2>
      <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '28px' }}>
        Sign in to your Learning Compass account
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

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '12px' }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="spin" color="#000000" /> Signing In...
            </>
          ) : (
            <>
              <LogIn size={18} /> Sign In
            </>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.65)' }}>
        Don't have an account?{' '}
        <Link to="/register" style={{ fontWeight: 600, color: '#ffffff' }}>Create account</Link>
      </p>
    </div>
  );
};
