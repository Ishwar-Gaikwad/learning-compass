const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token') || localStorage.getItem('learning_compass_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  // Delete Content-Type header if sending FormData (browser auto-sets boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Add standard 60-second timeout for async AI / ingestion operations
  const timeoutMs = options.timeout || 60000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let friendlyMessage = data.message;

      // Handle specific HTTP error status codes with clean, friendly messages
      switch (response.status) {
        case 400:
          friendlyMessage = data.message || 'Invalid request parameters. Please verify your input.';
          break;
        case 401:
          friendlyMessage = data.message || 'Your session has expired. Please sign in again.';
          localStorage.removeItem('token');
          localStorage.removeItem('learning_compass_token');
          break;
        case 403:
          friendlyMessage = data.message || 'You do not have permission to perform this action.';
          break;
        case 404:
          friendlyMessage = data.message || 'The requested resource could not be found.';
          break;
        case 409:
          friendlyMessage = data.message || 'A conflicting record already exists.';
          break;
        case 429:
          friendlyMessage = data.message || 'Too many requests. Please wait a moment and try again.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          friendlyMessage = 'Server is currently unable to process your request. Please try again later.';
          break;
        default:
          friendlyMessage = data.message || 'An unexpected error occurred. Please try again.';
          break;
      }

      const error = new Error(friendlyMessage);
      error.status = response.status;
      error.code = data.errorCode || data.code || `HTTP_${response.status}`;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      const timeoutError = new Error('The operation timed out. Please check your connection or try again.');
      timeoutError.status = 408;
      timeoutError.code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }

    if (!err.status) {
      err.status = 500;
      err.code = 'NETWORK_ERROR';
      err.message = 'Unable to connect to the server. Please check your internet connection.';
    }
    throw err;
  }
};

