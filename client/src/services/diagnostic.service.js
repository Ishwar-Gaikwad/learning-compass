import { apiClient } from './api.js';

export const diagnosticService = {
  async getAssessmentAttempts(assessmentId) {
    const res = await apiClient(`/assessments/${assessmentId}/attempts`, {
      method: 'GET'
    });
    return res.data?.attempts || [];
  },

  async getDiagnosticReport(attemptId) {
    const res = await apiClient(`/attempts/${attemptId}/diagnostic-report`, {
      method: 'GET'
    });
    return res.data?.report;
  },

  async generateDiagnosticReport(attemptId) {
    const res = await apiClient(`/attempts/${attemptId}/diagnose`, {
      method: 'POST'
    });
    return res.data?.report;
  },

  async getAttemptDetails(attemptId) {
    const res = await apiClient(`/attempts/${attemptId}`, {
      method: 'GET'
    });
    return res.data;
  }
};
