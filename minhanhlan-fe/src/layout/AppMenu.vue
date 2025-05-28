<script setup>
import { authService } from '@/service/AuthService';
import { masterDataService } from '@/service/MasterDataService';
import { useMenuStore } from '@/stores/menuStore';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import AppMenuItem from './AppMenuItem.vue';

const menuStore = useMenuStore();

const toast = useToast();

const model = ref([
    {
        label: 'Quản lý nhân sự',
        requiresAdmin: true,
        items: [
            { label: 'Quản lý phòng ban', icon: 'pi pi-fw pi-building-columns', to: '/department' },
            { label: 'Quản lý nhân viên', icon: 'pi pi-fw pi-users', to: '/employee' }
        ]
    },
    {
        label: 'Quản lý bảng hàng',
        items: []
    },
    {
        label: 'Quản lý hệ thống',
        requiresAdmin: true,
        items: [
            { label: 'Quản lý loại căn hộ', icon: 'pi pi-fw pi-cog', to: '/master-data' },
            { label: 'Quản lý quyền truy cập', icon: 'pi pi-fw pi-ban', to: '/user-permissions' },
            { label: 'Import dữ liệu', icon: 'pi pi-fw pi-upload', to: '/import' }
        ]
    }
]);

const isAdmin = computed(() => authService.isAdmin());

const filteredModel = computed(() => {
    return model.value
        .map((group) => {
            // Bỏ qua group nếu requiresAdmin và không phải admin
            if (group.requiresAdmin && !isAdmin.value) return null;

            // Nếu group có items con yêu cầu quyền, lọc tiếp từng item
            const filteredItems = group.items?.filter((item) => {
                return !item.requiresAdmin || isAdmin.value;
            });

            return {
                ...group,
                items: filteredItems,
                expanded: true
            };
        })
        .filter(Boolean); // loại bỏ null group
});

const fetchMenuData = async () => {
    try {
        const res = await masterDataService.getAllNoPaging();
        const productItems = res.data.map((item) => {
            return {
                label: item.name,
                icon: 'pi pi-fw pi-building',
                items: item.children?.map((menu) => ({
                    label: menu.name,
                    icon: 'pi pi-fw pi-home',
                    to: `/product/${item.id}/${menu.id}`
                }))
            };
        });
        const firstProductRoute = productItems?.[0]?.items?.[0]?.to;
        if (firstProductRoute) {
            menuStore.setDefaultProductRoute(firstProductRoute);
        }
        model.value[1].items = productItems;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được dữ liệu' });
    }
};

onMounted(() => {
    fetchMenuData();
});
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in filteredModel" :key="i">
            <app-menu-item v-if="!item.separator" :item="item" :index="i" />
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
