// src/service/MasterDataService.js
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
    updateOrder(id, order) {
        return axiosInstance.patch(`/master-data/${id}/order`, { order });
    },
    // Thêm API để update order cho parents
    updateParentOrders(orderUpdates) {
        return axiosInstance.patch('/master-data/parents/reorder', orderUpdates);
    },
    // Thêm API để update order cho children
    updateChildrenOrders(parentId, orderUpdates) {
        return axiosInstance.patch(`/master-data/${parentId}/children/reorder`, orderUpdates);
    },
    remove(id) {
        return axiosInstance.delete(`/master-data/${id}`);
    }
};