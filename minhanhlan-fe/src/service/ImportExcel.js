import axiosInstance from '@/plugin/axios';

const BASE_URL = '/import-excel';

export const importExcelService = {
  import(formData) {
    return axiosInstance.post(`${BASE_URL}/products`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
}