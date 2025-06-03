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

    // Enhanced API để update order cho parents
    updateParentOrders(orderUpdates) {
        console.log('Updating parent orders:', orderUpdates);
        return axiosInstance.patch('/master-data/parents/reorder', orderUpdates);
    },

    // Enhanced API để update order cho children
    updateChildrenOrders(parentId, orderUpdates) {
        console.log('Updating children orders for parent:', parentId, orderUpdates);
        return axiosInstance.patch(`/master-data/${parentId}/children/reorder`, orderUpdates);
    },

    remove(id) {
        return axiosInstance.delete(`/master-data/${id}`);
    }
};