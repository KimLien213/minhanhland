import AppLayout from '@/layout/AppLayout.vue';
import { authService } from '@/service/AuthService';
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            children: [
                {
                    path: '/employee',
                    name: 'employee',
                    component: () => import('@/views/pages/User.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true }
                },
                {
                    path: '/department',
                    name: 'department',
                    component: () => import('@/views/pages/Department.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true }
                },
                {
                    path: '/product/:subdivision/:type',
                    name: 'product',
                    component: () => import('@/views/pages/Product.vue'),
                    meta: { requiresAuth: true }
                },
                {
                    path: '/master-data',
                    name: 'master-data',
                    component: () => import('@/views/pages/MasterData.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true }
                },
                {
                    path: '/user-permissions',
                    name: 'user-permissions',
                    component: () => import('@/views/pages/UserProductPermissions.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true }
                },
                {
                    path: '/import',
                    name: 'import',
                    component: () => import('@/views/pages/FileImport.vue'),
                    meta: { requiresAuth: true, requiresAdmin: true }
                },
            ]
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },
        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue'),
            meta: { requiresAuth: false }
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        }
    ]
});

router.beforeEach((to, from, next) => {
    const isLoggedIn = authService.isAuthenticated();
    const isAdmin = authService.isAdmin();
    const requiresAuth = to.meta.requiresAuth;
    const requiresAdmin = to.meta.requiresAdmin || false;

    if (requiresAuth && !isLoggedIn) {
        next({ name: 'login' });
    } else if (requiresAdmin && !isAdmin) {
        next({ name: 'accessDenied' });
    } else {
        next();
    }
});

export default router;
