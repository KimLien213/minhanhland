import router from '@/router';
import { authService } from '@/service/AuthService';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const axiosInstance = axios.create({
    baseURL: API_URL,
});

// Request interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        const token = authService.getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        if (error.response?.status === 401) {
            const errorMessage = error.response?.data?.message;

            // Kiểm tra nếu là lỗi phiên đăng nhập không hợp lệ
            if (errorMessage?.includes('Phiên đăng nhập không hợp lệ') ||
                errorMessage?.includes('đăng nhập lại') ||
                !authService.getToken()) {

                // Xóa token và chuyển về trang login
                localStorage.removeItem('access_token');

                // Hiển thị thông báo
                if (window.showToast) {
                    window.showToast('error', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                }

                // Chuyển về trang login
                router.push('/auth/login');
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;