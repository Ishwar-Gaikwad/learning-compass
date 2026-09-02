import { AppError } from '../utils/AppError.js';

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required. Please log in to access this resource.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};
