import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/auth.service.js';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(
    localStorage.getItem('token') || localStorage.getItem('learning_compass_token') || null
  );

  // Restore current-user session on app mount
  useEffect(() => {
    let isMounted = true;

    const restoreUserSession = async () => {
      const storedToken = localStorage.getItem('token') || localStorage.getItem('learning_compass_token');

      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const meUser = await authService.getMe();
        if (isMounted) {
          setUser(meUser);
          setToken(storedToken);
        }
      } catch (err) {
        console.warn('[AuthContext] Session restoration result:', err.message, 'Status:', err.status);

        // ONLY remove token if status is explicitly 401 (invalid/expired JWT or user deleted)
        if (err.status === 401) {
          console.warn('[AuthContext] Genuine 401 received. Clearing invalid token.');
          localStorage.removeItem('token');
          localStorage.removeItem('learning_compass_token');
          if (isMounted) {
            setUser(null);
            setToken(null);
          }
        } else {
          // Temporary server/network error (500, network offline, 502/503, timeout)
          // DO NOT delete valid token from localStorage
          console.warn('[AuthContext] Temporary server/network error during session restoration. Token retained.');
          if (isMounted) {
            setUser(null);
            setToken(storedToken);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restoreUserSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials) => {
    const result = await authService.login(credentials);
    localStorage.setItem('token', result.token);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  };

  const register = async (userData) => {
    const result = await authService.register(userData);
    localStorage.setItem('token', result.token);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('learning_compass_token');
    setUser(null);
    setToken(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !loading && !!user,
    role: user?.role || null,
    loading,
    isLoading: loading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

