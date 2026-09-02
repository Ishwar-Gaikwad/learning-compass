import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    token: result.token,
    data: {
      user: result.user
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  res.status(200).json({
    success: true,
    message: 'Login successful',
    token: result.token,
    data: {
      user: result.user
    }
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);
  res.status(200).json({
    success: true,
    data: {
      user
    }
  });
});
