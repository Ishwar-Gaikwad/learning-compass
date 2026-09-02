import { apiClient } from './api.js';

export const courseService = {
  async getCourses() {
    const res = await apiClient('/courses', { method: 'GET' });
    return res.data?.courses || [];
  },

  async getCourse(id) {
    const res = await apiClient(`/courses/${id}`, { method: 'GET' });
    return res.data?.course;
  },

  async createCourse(courseData) {
    const res = await apiClient('/courses', {
      method: 'POST',
      body: JSON.stringify(courseData)
    });
    return res.data?.course;
  },

  async updateCourse(id, courseData) {
    const res = await apiClient(`/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(courseData)
    });
    return res.data?.course;
  },

  async deleteCourse(id) {
    const res = await apiClient(`/courses/${id}`, { method: 'DELETE' });
    return res;
  }
};
