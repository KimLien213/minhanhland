import axiosInstance from '@/plugin/axios';

export const userService = {
    async getAllNoPaging() {
        const res = await axiosInstance.get('/users/all');
        return res.data;
    },

    async getAll(params = {}) {
        const res = await axiosInstance.get('/users', { params });
        return res.data;
    },
    async getById(id) {
        const res = await axiosInstance.get(`/users/${id}`);
        return res.data;
    },

    async create(payload) {
        const res = await axiosInstance.post('/users', payload);
        return res.data;
    },

    async update(id, payload) {
        const res = await axiosInstance.patch(`/users/${id}`, payload);
        return res.data;
    },

    async remove(id) {
        const res = await axiosInstance.delete(`/users/${id}`);
        return res.data;
    }
};
