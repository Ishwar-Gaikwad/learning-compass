import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const signToken = (id) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('JWT_SECRET is missing from environment variables.', 500, 'CONFIG_ERROR');
  }
  return jwt.sign({ id }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const formatUserResponse = (user) => {
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profile: user.profile,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

export const authService = {
  async registerUser({ name, email, password, role, profile }) {
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      throw new AppError('Email address is already registered.', 400, 'DUPLICATE_EMAIL');
    }

    const allowedRoles = ['student', 'teacher'];
    const assignedRole = (role && allowedRoles.includes(role)) ? role : 'student';

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole,
      profile
    });

    const token = signToken(newUser._id);
    return {
      token,
      user: formatUserResponse(newUser)
    };
  },

  async loginUser({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !user.isActive) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = signToken(user._id);
    return {
      token,
      user: formatUserResponse(user)
    };
  },

  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError('User account not found or deactivated.', 404, 'USER_NOT_FOUND');
    }
    return formatUserResponse(user);
  }
};
