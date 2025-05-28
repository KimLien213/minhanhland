<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import { authService } from '@/service/AuthService';
import { useMenuStore } from '@/stores/menuStore';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const menuStore = useMenuStore();
const router = useRouter();
const loading = ref(false);
const username = ref('');
const password = ref('');
const errorMsg = ref('');
const usernameError = ref('');
const passwordError = ref('');

const handleLogin = async () => {
    usernameError.value = '';
    passwordError.value = '';
    errorMsg.value = '';

    if (!username.value) {
        usernameError.value = 'Vui lòng nhập tên đăng nhập';
    }
    if (!password.value) {
        passwordError.value = 'Vui lòng nhập mật khẩu';
    }

    if (usernameError.value || passwordError.value) return;

    try {
        await authService.login(username.value, password.value);
        if (authService.isAdmin()) {
            router.push({ name: 'employee' });
        } else {
            router.push(menuStore.defaultProductRoute || '/unauthorized');
        }
    } catch (err) {
        errorMsg.value = 'Tài khoản hoặc mật khẩu không đúng';
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <FloatingConfigurator />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <div class="flex justify-center mb-4">
                            <Image src="/images/minhanh_logo.png" alt="Image" width="180" />
                        </div>
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Hệ thống quản lý nội bộ</div>
                        <span class="text-muted-color font-medium">Đăng nhập để tiếp tục</span>
                    </div>

                    <div>
                        <label for="username" class="block text-surface-900 dark:text-surface-0 text-lg font-medium mb-1">Tên đăng nhập</label>
                        <InputText id="username" type="text" placeholder="Tên đăng nhập" class="w-full md:w-[30rem] mb-2" v-model="username" :isValid="usernameError" />
                        <div v-if="usernameError" class="text-red-500 text-left mb-4">{{ usernameError }}</div>

                        <label for="password" class="block text-surface-900 dark:text-surface-0 font-medium text-lg mb-1">Mật khẩu</label>
                        <Password id="password" v-model="password" placeholder="Mật khẩu" :toggleMask="true" :feedback="false" fluid class="mb-2 w-full" :isValid="passwordError" />
                        <div v-if="passwordError" class="text-red-500 text-left mb-4">{{ passwordError }}</div>

                        <div v-if="errorMsg" class="text-red-500 mb-4 text-left">{{ errorMsg }}</div>

                        <Button label="Đăng nhập" @click="handleLogin" class="w-full mt-5 mb-8 gap-8" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
