import { AppError } from '../utils/AppError.js';

export const errorMiddleware = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.status = err.status || 'error';

  // Server-side diagnostic log (without logging raw secrets or request bodies)
  if (process.env.NODE_ENV === 'production') {
    console.error(`[Error Diagnostics] ${req.method} ${req.originalUrl} - Status: ${error.statusCode} - ${error.message}`);
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const keys = Object.keys(err.keyValue || {});
    let message = 'A conflicting record already exists.';
    if (keys.includes('email')) {
      message = 'An account with this email address already exists.';
    } else if (keys.includes('accessCode')) {
      message = 'This assessment access code already exists.';
    } else if (keys.includes('code')) {
      message = 'A course with this code already exists.';
    } else if (keys.length > 0) {
      message = `A duplicate record already exists for ${keys.join(', ')}.`;
    }
    error = new AppError(message, 400, 'DUPLICATE_KEY_ERROR');
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token has expired. Please log in again.', 401, 'EXPIRED_TOKEN');
  }

  res.status(error.statusCode).json({
    success: false,
    status: error.status,
    message: error.message || 'Internal Server Error',
    ...(error.errorCode && { errorCode: error.errorCode }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

