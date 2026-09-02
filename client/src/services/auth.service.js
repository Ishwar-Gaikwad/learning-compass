import { apiClient } from './api.js';

export const authService = {
  async register(userData) {
    const res = await apiClient('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    return {
      token: res.token,
      user: res.data?.user
    };
  },

  async login(credentials) {
    const res = await apiClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    return {
      token: res.token,
      user: res.data?.user
    };
  },

  async getMe() {
    const res = await apiClient('/auth/me', {
      method: 'GET'
    });
    return res.data?.user;
  }
};
