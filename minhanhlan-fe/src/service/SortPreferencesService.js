// src/service/SortPreferencesService.js
import axiosInstance from '@/plugin/axios';

export const sortPreferencesService = {
  async saveSortPreference(pageKey, sortBy, sortOrder) {
    return axiosInstance.post('/user-sort-preferences', {
      pageKey,
      sortBy,
      sortOrder
    });
  },

  async getSortPreference(pageKey) {
    const res = await axiosInstance.get(`/user-sort-preferences/${pageKey}`);
    return res.data;
  },

  async getAllSortPreferences() {
    const res = await axiosInstance.get('/user-sort-preferences');
    return res.data;
  }
};