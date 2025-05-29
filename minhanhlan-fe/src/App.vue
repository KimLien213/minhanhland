<script setup>
import { setToastInstance } from '@/plugin/toast';
import { authService } from '@/service/AuthService';
import { useMenuStore } from '@/stores/menuStore';
import { useToast } from 'primevue/usetoast';
import { nextTick, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const toast = useToast();
setToastInstance(toast);

const router = useRouter();
const route = useRoute();
const menuStore = useMenuStore();

// Chỉ xử lý redirect khi thực sự ở root path và không phải reload
onMounted(async () => {
    // Kiểm tra nếu đây là lần đầu load ứng dụng ở root path
    if (route.path === '/' && window.location.pathname === '/') {
        await handleRootRedirect();
    }
});

// Watch menu store để redirect sau khi menu data được load
watch(
    () => menuStore.defaultProductRoute,
    async (newDefaultRoute) => {
        // Chỉ redirect nếu đang ở root path và có default route
        if (route.path === '/' && window.location.pathname === '/' && newDefaultRoute) {
            if (authService.isAuthenticated() && !authService.isAdmin()) {
                await router.replace(newDefaultRoute);
                await nextTick();
                window.dispatchEvent(new CustomEvent('route-changed'));
            }
        }
    }
);

async function handleRootRedirect() {
    // Kiểm tra authentication
    if (!authService.isAuthenticated()) {
        await router.replace('/auth/login');
        return;
    }

    // Đợi một chút cho các service khởi tạo
    await nextTick();

    // Admin redirect
    if (authService.isAdmin()) {
        if (menuStore.defaultProductRoute) {
            await router.replace(menuStore.defaultProductRoute);
        } else {
            await router.replace('/employee');
        }
        await nextTick();
        window.dispatchEvent(new CustomEvent('route-changed'));
        return;
    }

    // User thường - chờ menu data load nếu chưa có
    if (menuStore.defaultProductRoute) {
        await router.replace(menuStore.defaultProductRoute);
        await nextTick();
        window.dispatchEvent(new CustomEvent('route-changed'));
    }
    // Nếu chưa có defaultProductRoute, để menu component tự xử lý
}
</script>

<template>
    <router-view />
</template>

<style scoped></style>