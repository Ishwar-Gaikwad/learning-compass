import { apiClient } from './api.js';

export const materialService = {
  async getMaterials(courseId, topicId) {
    const res = await apiClient(`/courses/${courseId}/topics/${topicId}/materials`, { method: 'GET' });
    return res.data?.materials || [];
  },

  async uploadMaterial(courseId, topicId, file, title) {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }

    const res = await apiClient(`/courses/${courseId}/topics/${topicId}/materials`, {
      method: 'POST',
      body: formData
    });

    return res.data?.material;
  },

  async processMaterial(materialId) {
    const res = await apiClient(`/materials/${materialId}/process`, {
      method: 'POST'
    });
    return res.data;
  },

  async getMaterialStatus(materialId) {
    const res = await apiClient(`/materials/${materialId}/status`, { method: 'GET' });
    return res.data;
  }
};
