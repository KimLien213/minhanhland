import axiosInstance from '@/plugin/axios';

export const masterDataService = {
    getAllNoPaging() {
        return axiosInstance.get('/master-data/all');
    },
    getAll(params = {}) {
        return axiosInstance.get('/master-data', { params });
    },
    create(data) {
        return axiosInstance.post('/master-data', data);
    },
    update(id, data) {
        return axiosInstance.put(`/master-data/${id}`, data);
    },
    remove(id) {
        return axiosInstance.delete(`/master-data/${id}`);
    }
};
