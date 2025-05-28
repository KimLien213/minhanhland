import router from '@/router';
import { authService } from '@/service/AuthService';
import axios from 'axios';
import { showToast } from './toast';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000'
});

axiosInstance.interceptors.request.use((config) => {
    const token = authService.getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
axiosInstance.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err.response?.status;
        const message = err.response?.data?.message || 'Lỗi không xác định';

        if (status === 401) {
            authService.logout();
            router.push({ name: 'login' });
        } else {
            showToast({
                severity: 'error',
                summary: `Lỗi ${status || ''}`,
                detail: Array.isArray(message) ? message.join(', ') : message,
                life: 4000
            });
        }

        return Promise.reject(err);
    }
);
export default axiosInstance;
