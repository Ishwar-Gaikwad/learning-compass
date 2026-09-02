import { apiClient } from './api.js';

export const reassessmentService = {
  async generateReassessment(reportId) {
    const res = await apiClient(`/diagnostic-reports/${reportId}/reassessment`, {
      method: 'POST'
    });
    return res.data;
  },

  async processReassessment(attemptId) {
    const res = await apiClient(`/attempts/${attemptId}/process-reassessment`, {
      method: 'POST'
    });
    return res.data;
  },

  async getReassessmentComparison(attemptId) {
    const res = await apiClient(`/attempts/${attemptId}/reassessment-comparison`, {
      method: 'GET'
    });
    return res.data?.comparison;
  }
};
