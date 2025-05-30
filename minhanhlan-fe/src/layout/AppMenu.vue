<!-- src/layout/AppMenu.vue - Updated to store menu data in store -->
<script setup>
import { useLayout } from '@/layout/composables/layout';
import { authService } from '@/service/AuthService';
import { masterDataService } from '@/service/MasterDataService';
import { useMenuStore } from '@/stores/menuStore';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppMenuItem from './AppMenuItem.vue';

const menuStore = useMenuStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();
const { setActiveMenuItem, layoutState } = useLayout();

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
            if (group.requiresAdmin && !isAdmin.value) return null;

            const filteredItems = group.items?.filter((item) => {
                return !item.requiresAdmin || isAdmin.value;
            });

            return {
                ...group,
                items: filteredItems,
                expanded: true
            };
        })
        .filter(Boolean);
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

        // Store menu data in store for later use
        menuStore.setMenuData(res.data);

        const firstProductRoute = productItems?.[0]?.items?.[0]?.to;
        if (firstProductRoute) {
            menuStore.setDefaultProductRoute(firstProductRoute);
        }

        model.value[1].items = productItems;

        // Đợi DOM update rồi mới set active menu
        await nextTick();
        setTimeout(() => {
            setActiveMenuForCurrentRoute();
        }, 100);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được dữ liệu' });
    }
};

// Reset và clear active menu trước khi set mới
const clearActiveMenu = () => {
    layoutState.activeMenuItem = null;
};

// Hàm tính toán active menu dựa trên route params
const setActiveMenuForCurrentRoute = () => {
    // Lấy current route info
    const currentRoute = router.currentRoute.value;
    const { subdivision, type } = currentRoute.params;

    console.log('🎯 Current route params:', { subdivision, type });
    console.log('🎯 Current route path:', currentRoute.path);

    // Clear active menu trước
    clearActiveMenu();

    if (!subdivision || !type) {
        console.log('❌ No route params found');
        return;
    }

    // Tìm menu item dựa trên route params
    const findMenuItemByParams = (items, parentKey = '') => {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemKey = parentKey ? `${parentKey}-${i}` : String(i);

            if (item.items && item.items.length > 0) {
                // Tìm trong children
                for (let j = 0; j < item.items.length; j++) {
                    const childItem = item.items[j];
                    const childKey = `${itemKey}-${j}`;

                    // Kiểm tra xem route có match với menu item không
                    if (childItem.to) {
                        const expectedPath = `/product/${subdivision}/${type}`;
                        if (childItem.to === expectedPath) {
                            console.log(`✅ Found matching menu: ${childItem.label} (${childKey})`);
                            console.log(`   Expected: ${expectedPath}`);
                            console.log(`   Menu path: ${childItem.to}`);
                            return childKey;
                        }
                    }
                }

                // Recurse vào children
                const childResult = findMenuItemByParams(item.items, itemKey);
                if (childResult) return childResult;
            }
        }
        return null;
    };

    const activeKey = findMenuItemByParams(filteredModel.value);

    if (activeKey) {
        console.log(`🎉 Setting active menu: ${activeKey}`);
        setActiveMenuItem(activeKey);
    } else {
        console.log('❌ No matching menu found');
        console.log('Available menus:', filteredModel.value);
    }
};

// Watch route changes - sử dụng route params thay vì path
watch([() => route.params.subdivision, () => route.params.type], ([newSubdivision, newType], [oldSubdivision, oldType]) => {
    console.log('🛣️ Route params changed:', {
        old: { subdivision: oldSubdivision, type: oldType },
        new: { subdivision: newSubdivision, type: newType }
    });

    if (newSubdivision && newType) {
        setTimeout(() => {
            setActiveMenuForCurrentRoute();
        }, 50);
    }
});

// Watch for menu data changes
watch(
    () => model.value[1].items.length,
    (newLength) => {
        if (newLength > 0) {
            console.log('📋 Menu data loaded');
            setTimeout(() => {
                setActiveMenuForCurrentRoute();
            }, 100);
        }
    }
);

onMounted(async () => {
    console.log('🚀 AppMenu mounted');
    console.log('📍 Current route:', route);
    console.log('📍 Route params:', route.params);

    await fetchMenuData();

    // Listen for route changes
    window.addEventListener('route-changed', () => {
        console.log('📢 Route changed event');
        setTimeout(() => {
            setActiveMenuForCurrentRoute();
        }, 100);
    });

    // Initial set active menu
    setTimeout(() => {
        setActiveMenuForCurrentRoute();
    }, 200);
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