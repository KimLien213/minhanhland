import axiosInstance from '@/plugin/axios';

export const departmentService = {
    async getAll(params = {}) {
        const res = await axiosInstance.get('/departments', { params });
        return res.data;
    },

    async getAllNoPaging() {
        const res = await axiosInstance.get('/departments/all');
        return res;
    },

    async getById(id) {
        const res = await axiosInstance.get(`/departments/${id}`);
        return res.data;
    },

    async create(payload) {
        const res = await axiosInstance.post('/departments', payload);
        return res.data;
    },

    async update(id, payload) {
        const res = await axiosInstance.patch(`/departments/${id}`, payload);
        return res.data;
    },

    async remove(id) {
        const res = await axiosInstance.delete(`/departments/${id}`);
        return res.data;
    }
};
