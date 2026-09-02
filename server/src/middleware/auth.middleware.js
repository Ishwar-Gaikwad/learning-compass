import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Authentication required. Please log in to access this resource.', 401, 'UNAUTHORIZED'));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return next(new AppError('JWT secret is not configured on server.', 500, 'CONFIG_ERROR'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (jwtErr) {
    return next(new AppError('Invalid or expired authentication token. Please log in again.', 401, 'INVALID_TOKEN'));
  }

  const currentUser = await User.findById(decoded.id);

  if (!currentUser || !currentUser.isActive) {
    return next(new AppError('User belonging to this token no longer exists or is inactive.', 401, 'USER_NOT_FOUND'));
  }

  req.user = currentUser;
  next();
});
