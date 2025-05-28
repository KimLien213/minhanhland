import axiosInstance from '@/plugin/axios';
import { useMenuStore } from '@/stores/menuStore';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { masterDataService } from './MasterDataService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const authApi = axios.create({
    baseURL: API_URL + '/auth'
});

export const authService = {
    async login(username, password) {
        const response = await authApi.post('/login', { username, password });
        const token = response.data.access_token;
        localStorage.setItem('access_token', token);
        const isAdmin = this.isAdmin();

        if (!isAdmin) {
            const menuRes = await masterDataService.getAllNoPaging();
            const productItems = menuRes.data;

            const firstRoute =
                productItems?.[0]?.children?.[0]
                    ? `/product/${productItems[0].id}/${productItems[0].children[0].id}`
                    : null;

            if (firstRoute) {
                const menuStore = useMenuStore();
                menuStore.setDefaultProductRoute(firstRoute);
            }
        }
        return token;
    },

    logout() {
        localStorage.removeItem('access_token');
    },

    getMe() {
        return axiosInstance.get(`/auth/me`);
    },

    getToken() {
        return localStorage.getItem('access_token');
    },
    isAuthenticated() {
        return !!localStorage.getItem('access_token');
    },
    getRoleFromToken() {
        const token = this.getToken();
        if (!token) return null;

        try {
            const decoded = jwtDecode(token);
            return decoded.role || null;
        } catch (e) {
            return null;
        }
    },
    isAdmin() {
        return this.getRoleFromToken() === 'ADMIN';
    },
};
