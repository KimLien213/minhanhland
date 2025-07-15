import axiosInstance from '@/plugin/axios';

const BASE_URL = '/products';

export const productService = {
    /**
     * Tạo sản phẩm mới kèm ảnh (multipart/form-data)
     * @param {FormData} formData
     */
    create(formData) {
        return axiosInstance.post(BASE_URL, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    /**
     * Cập nhật sản phẩm theo ID kèm ảnh mới (multipart/form-data)
     * @param {number|string} id
     * @param {FormData} formData
     */
    update(id, formData) {
        return axiosInstance.put(`${BASE_URL}/${id}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    /**
     * Cập nhật thứ tự sản phẩm
     * @param {Object} orderData
     */
    updateProductOrders(orderData) {
        return axiosInstance.patch(`${BASE_URL}/update-order`, orderData);
    },

    /**
     * Xoá sản phẩm theo ID
     * @param {number|string} id
     */
    remove(id) {
        return axiosInstance.delete(`${BASE_URL}/${id}`);
    },

    /**
     * Lấy danh sách sản phẩm có phân trang, tìm kiếm, lọc, sort
     * @param {Object} queryParams
     */
    getAll(queryParams = {}) {
        return axiosInstance.get(BASE_URL, { params: queryParams });
    },

    /**
     * Lấy danh sách filter options cho các field
     */
    getFilterOptions(queryParams = {}) {
        return axiosInstance.get(`${BASE_URL}/filters`, { params: queryParams });
    },

    /**
     * Lấy cây phân khu - tòa (subdivision tree)
     */
    getSubdivisionTree() {
        return axiosInstance.get(`${BASE_URL}/tree`);
    }
};