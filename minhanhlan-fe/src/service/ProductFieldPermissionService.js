import axiosInstance from '@/plugin/axios';

export const productFieldPermissionService = {
    async getAll(queryParams = {}) {
        const res = await axiosInstance.get('/product-field-permissions', { params: queryParams });
        return res.data;
    },
    async createBulk(payload) {
        return axiosInstance.post('/product-field-permissions/bulk', payload);
    },
    async remove(id) {
        return axiosInstance.delete(`/product-field-permissions/${id}`);
    },
    async removeByUser(userId) {
        return axiosInstance.delete(`/product-field-permissions/user/${userId}`);
    },
    async getUsers() {
        const res = await axiosInstance.get('/users/all');
        return res.data;
    }
};
