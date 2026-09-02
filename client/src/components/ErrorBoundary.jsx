import React, { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-dark, #0b0f19)',
          color: 'var(--text-main, #f3f4f6)'
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '16px', color: '#f43f5e' }}>Something went wrong</h1>
          <p style={{ color: 'var(--text-muted, #9ca3af)', maxWidth: '500px', marginBottom: '24px' }}>
            {this.state.error?.message || 'An unexpected error occurred in the application shell.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.assign('/')}
          >
            Return to Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
