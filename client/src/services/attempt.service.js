import { apiClient } from './api.js';

export const attemptService = {
  async startAttempt(assessmentId) {
    const res = await apiClient(`/assessments/${assessmentId}/attempts`, {
      method: 'POST'
    });
    return res.data;
  },

  async getCurrentAttempt(assessmentId) {
    const res = await apiClient(`/assessments/${assessmentId}/attempts/current`, {
      method: 'GET'
    });
    return res.data;
  },

  async getAttemptById(attemptId) {
    const res = await apiClient(`/attempts/${attemptId}`, {
      method: 'GET'
    });
    return res.data;
  },

  async saveResponse(attemptId, questionId, studentAnswer) {
    const res = await apiClient(`/attempts/${attemptId}/responses`, {
      method: 'POST',
      body: JSON.stringify({ questionId, studentAnswer })
    });
    return res.data;
  },

  async submitAttempt(attemptId) {
    const res = await apiClient(`/attempts/${attemptId}/submit`, {
      method: 'POST'
    });
    return res.data;
  }
};
