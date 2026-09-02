import { AppError } from '../utils/AppError.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateRegisterInput = (req, res, next) => {
  const { name, email, password, role } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return next(new AppError('Name is required and must be at least 2 characters long.', 400, 'INVALID_NAME'));
  }

  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return next(new AppError('Please provide a valid email address.', 400, 'INVALID_EMAIL'));
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return next(new AppError('Password is required and must be at least 6 characters long.', 400, 'INVALID_PASSWORD'));
  }

  if (role && !['teacher', 'student', 'admin'].includes(role)) {
    return next(new AppError('Role must be one of: teacher, student, admin.', 400, 'INVALID_ROLE'));
  }

  next();
};

export const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    return next(new AppError('Please provide a valid email address.', 400, 'INVALID_EMAIL'));
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    return next(new AppError('Password is required.', 400, 'MISSING_PASSWORD'));
  }

  next();
};

export const validateCourseInput = (req, res, next) => {
  const { title, description, code, subject, gradeLevel, status } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return next(new AppError('Course title is required and must be at least 2 characters long.', 400, 'INVALID_TITLE'));
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return next(new AppError('Course description is required.', 400, 'MISSING_DESCRIPTION'));
  }

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return next(new AppError('Course code is required.', 400, 'MISSING_CODE'));
  }

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    return next(new AppError('Subject is required.', 400, 'MISSING_SUBJECT'));
  }

  if (!gradeLevel || typeof gradeLevel !== 'string' || gradeLevel.trim().length === 0) {
    return next(new AppError('Grade level is required.', 400, 'MISSING_GRADE_LEVEL'));
  }

  if (status && !['draft', 'published', 'archived'].includes(status)) {
    return next(new AppError('Status must be one of: draft, published, archived.', 400, 'INVALID_STATUS'));
  }

  next();
};

export const validateUpdateCourseInput = (req, res, next) => {
  const { title, status } = req.body;

  if (title !== undefined && (typeof title !== 'string' || title.trim().length < 2)) {
    return next(new AppError('Course title must be at least 2 characters long.', 400, 'INVALID_TITLE'));
  }

  if (status !== undefined && !['draft', 'published', 'archived'].includes(status)) {
    return next(new AppError('Status must be one of: draft, published, archived.', 400, 'INVALID_STATUS'));
  }

  next();
};

export const validateTopicInput = (req, res, next) => {
  const { title, order, learningObjectives } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return next(new AppError('Topic title is required and must be at least 2 characters long.', 400, 'INVALID_TITLE'));
  }

  if (order !== undefined && (!Number.isInteger(order) || order < 1)) {
    return next(new AppError('Order must be an integer at least 1.', 400, 'INVALID_ORDER'));
  }

  if (learningObjectives !== undefined && !Array.isArray(learningObjectives)) {
    return next(new AppError('Learning objectives must be an array of strings.', 400, 'INVALID_LEARNING_OBJECTIVES'));
  }

  next();
};

export const validateUpdateTopicInput = (req, res, next) => {
  const { title, order, learningObjectives } = req.body;

  if (title !== undefined && (typeof title !== 'string' || title.trim().length < 2)) {
    return next(new AppError('Topic title must be at least 2 characters long.', 400, 'INVALID_TITLE'));
  }

  if (order !== undefined && (!Number.isInteger(order) || order < 1)) {
    return next(new AppError('Order must be an integer at least 1.', 400, 'INVALID_ORDER'));
  }

  if (learningObjectives !== undefined && !Array.isArray(learningObjectives)) {
    return next(new AppError('Learning objectives must be an array of strings.', 400, 'INVALID_LEARNING_OBJECTIVES'));
  }

  next();
};
