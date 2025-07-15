<script setup>
import { masterDataService } from '@/service/MasterDataService';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import Sortable from 'sortablejs';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const toast = useToast();
const dt = ref();
const masterDataList = ref([]);
const masterDataDialog = ref(false);
const deleteDialog = ref(false);
const deleteMultiDialog = ref(false);
const selectedItems = ref();
const submitted = ref(false);
const item = ref({});
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

// Refs for sortable containers
const childrenSortableRefs = ref(new Map());

const fetchData = async () => {
    // Đặt loading về false ngay để tránh UI mờ
    loading.value = false;

    try {
        const res = await masterDataService.getAll(lazyParams.value);
        masterDataList.value = res.data.data;
        totalRecords.value = res.data.meta.total;

        console.log('📊 Data fetched:', masterDataList.value);

        // Re-initialize sortables after data fetch
        await nextTick();
        initializeSortables();
    } catch (err) {
        console.error('❌ Fetch error:', err);
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được dữ liệu' });
    } finally {
        loading.value = false;
    }
};

const buildings = ref([]);
const fetchBuilding = async () => {
    try {
        const res = await masterDataService.getAllNoPaging();
        buildings.value = res.data;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được dữ liệu' });
    }
};

const openNew = () => {
    item.value = {};
    submitted.value = false;
    masterDataDialog.value = true;
};

const hideDialog = () => {
    masterDataDialog.value = false;
    submitted.value = false;
};

const saveItem = async () => {
    submitted.value = true;
    if (!item.value.name?.trim()) return;

    try {
        console.log('💾 Saving item:', item.value);

        const payload = {
            name: item.value.name.trim(),
            description: item.value.description?.trim() || null,
            ...(item.value.parentId && { parentId: item.value.parentId })
        };

        console.log('📤 Save payload:', payload);

        if (item.value.id) {
            // Update existing item
            console.log(`🔄 Updating item with ID: ${item.value.id}`);
            const result = await masterDataService.update(item.value.id, payload);
            console.log('✅ Update result:', result);
            toast.add({
                severity: 'success',
                summary: 'Thành công',
                detail: `Đã cập nhật "${item.value.name}"`
            });
        } else {
            // Create new item
            console.log('➕ Creating new item');
            const result = await masterDataService.create(payload);
            console.log('✅ Create result:', result);
            toast.add({
                severity: 'success',
                summary: 'Thành công',
                detail: `Đã thêm "${item.value.name}"`
            });
        }

        masterDataDialog.value = false;
        await fetchData(); // Refresh data
    } catch (err) {
        console.error('❌ Save error:', err);
        console.error('Error details:', {
            message: err.message,
            response: err.response?.data,
            status: err.response?.status
        });

        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: err.response?.data?.message || 'Không thể lưu dữ liệu'
        });
    }
};

const editItem = (data) => {
    console.log('✏️ Editing item:', data);

    // Đảm bảo copy đúng tất cả fields
    item.value = {
        id: data.id,
        name: data.name || '',
        description: data.description || '',
        parentId: data.parentId || null
    };

    console.log('📝 Item set for edit:', item.value);
    submitted.value = false;
    masterDataDialog.value = true;
};

const confirmDeleteItem = (data) => {
    item.value = data;
    deleteDialog.value = true;
};

const deleteItem = async () => {
    try {
        await masterDataService.remove(item.value.id);
        toast.add({ severity: 'success', summary: 'Đã xoá', detail: item.value.name });
        deleteDialog.value = false;
        fetchData();
    } catch {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xoá' });
    }
};

const confirmDeleteSelected = () => {
    deleteMultiDialog.value = true;
};

const deleteSelectedItems = async () => {
    try {
        await Promise.all(selectedItems.value.map((i) => masterDataService.remove(i.id)));
        toast.add({ severity: 'success', summary: 'Đã xoá nhiều dòng' });
        selectedItems.value = null;
        deleteMultiDialog.value = false;
        fetchData();
    } catch {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xoá' });
    }
};

const lazyParams = ref({
    page: 1,
    limit: 10,
    sortBy: null,
    sortOrder: 'ASC',
    search: ''
});
const loading = ref(false);
const totalRecords = ref(0);

function onPage(event) {
    lazyParams.value.page = event.page + 1;
    lazyParams.value.limit = event.rows;
    fetchData();
}

function onSort(event) {
    lazyParams.value.sortBy = event.sortField;
    lazyParams.value.sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';
    fetchData();
}

// Handle reorder with detailed logging
const handleReorder = async (items, isChildren = false, parentId = null) => {
    console.log('🔄 handleReorder called:', {
        items: items.map((i) => ({ id: i.id, name: i.name })),
        isChildren,
        parentId,
        itemsLength: items.length
    });

    try {
        const reorderItems = items.map((item, index) => ({
            id: item.id,
            order: index + 1
        }));

        console.log('📤 Sending reorder request:', reorderItems);

        const result = await masterDataService.reorder(reorderItems);

        console.log('✅ Reorder API response:', result);

        toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: `Đã cập nhật thứ tự ${isChildren ? 'loại căn hộ' : 'phân khu'}`,
            life: 2000
        });
    } catch (err) {
        console.error('❌ Reorder error:', err);
        console.error('Error details:', {
            message: err.message,
            response: err.response?.data,
            status: err.response?.status
        });

        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Không thể cập nhật thứ tự: ' + (err.response?.data?.message || err.message)
        });

        // Refresh to reset state
        await fetchData();
    }
};

// Debounce để tránh call API quá nhiều lần
let reorderTimeout = null;
const debouncedReorder = (items, isChildren = false, parentId = null) => {
    console.log('⏱️ debouncedReorder called');

    if (reorderTimeout) {
        clearTimeout(reorderTimeout);
        console.log('⏱️ Cleared previous timeout');
    }

    reorderTimeout = setTimeout(() => {
        console.log('⏱️ Executing debounced reorder');
        handleReorder(items, isChildren, parentId);
    }, 500);
};

// Initialize sortable for parent items
const initializeParentSortable = () => {
    const tbody = document.querySelector('.sortable-datatable .p-datatable-tbody');
    console.log('🎯 Parent tbody element:', tbody);

    if (!tbody) {
        console.warn('⚠️ Parent tbody not found');
        return null;
    }

    const sortable = new Sortable(tbody, {
        animation: 200,
        easing: 'cubic-bezier(1, 0, 0, 1)',
        handle: '.drag-handle-parent',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        chosenClass: 'sortable-chosen',
        fallbackClass: 'sortable-fallback',
        forceFallback: true,
        fallbackTolerance: 3,
        removeCloneOnHide: true, // Thêm option này
        onStart: (evt) => {
            console.log('🎬 Parent drag start:', evt.oldIndex);
            document.body.style.cursor = 'grabbing';
        },
        onEnd: (evt) => {
            console.log('🎬 Parent drag end:', {
                oldIndex: evt.oldIndex,
                newIndex: evt.newIndex,
                changed: evt.oldIndex !== evt.newIndex
            });

            document.body.style.cursor = 'default';

            if (evt.oldIndex !== evt.newIndex) {
                console.log('📝 Updating parent state...');
                console.log(
                    'Before:',
                    masterDataList.value.map((i) => ({ id: i.id, name: i.name }))
                );

                // Cập nhật state Vue trước
                const movedItem = masterDataList.value.splice(evt.oldIndex, 1)[0];
                masterDataList.value.splice(evt.newIndex, 0, movedItem);

                console.log(
                    'After:',
                    masterDataList.value.map((i) => ({ id: i.id, name: i.name }))
                );

                // Sau đó gọi API
                debouncedReorder(masterDataList.value, false);
            }
        }
    });

    console.log('✅ Parent sortable initialized');
    return sortable;
};

// Initialize sortable for children items
const initializeChildrenSortable = (parentId) => {
    const containerRef = childrenSortableRefs.value.get(parentId);
    console.log(`🎯 Children container for ${parentId}:`, containerRef);

    if (!containerRef) {
        console.warn(`⚠️ Children container not found for parent ${parentId}`);
        return null;
    }

    const sortable = new Sortable(containerRef, {
        animation: 200,
        easing: 'cubic-bezier(1, 0, 0, 1)',
        handle: '.drag-handle-child',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        chosenClass: 'sortable-chosen',
        fallbackClass: 'sortable-fallback',
        forceFallback: true,
        fallbackTolerance: 3,
        removeCloneOnHide: true, // Thêm option này
        onStart: (evt) => {
            console.log(`🎬 Children drag start for ${parentId}:`, evt.oldIndex);
            document.body.style.cursor = 'grabbing';
        },
        onEnd: (evt) => {
            console.log(`🎬 Children drag end for ${parentId}:`, {
                oldIndex: evt.oldIndex,
                newIndex: evt.newIndex,
                changed: evt.oldIndex !== evt.newIndex
            });

            document.body.style.cursor = 'default';

            if (evt.oldIndex !== evt.newIndex) {
                console.log('📝 Updating children state...');

                // Tìm parent và cập nhật children array
                const parentIndex = masterDataList.value.findIndex((p) => p.id === parentId);
                console.log('Parent index found:', parentIndex);

                if (parentIndex !== -1) {
                    const children = masterDataList.value[parentIndex].children;
                    console.log(
                        'Before children update:',
                        children.map((c) => ({ id: c.id, name: c.name }))
                    );

                    const movedItem = children.splice(evt.oldIndex, 1)[0];
                    children.splice(evt.newIndex, 0, movedItem);

                    console.log(
                        'After children update:',
                        children.map((c) => ({ id: c.id, name: c.name }))
                    );

                    // Gọi API để cập nhật DB
                    debouncedReorder(children, true, parentId);
                } else {
                    console.error('❌ Parent not found for ID:', parentId);
                }
            }
        }
    });

    console.log(`✅ Children sortable initialized for ${parentId}`);
    return sortable;
};

// Initialize all sortables
const sortableInstances = ref(new Map());

const initializeSortables = async () => {
    console.log('🚀 Initializing sortables...');
    await nextTick();

    // Cleanup existing sortables
    sortableInstances.value.forEach((sortable, key) => {
        console.log(`🧹 Cleaning up sortable: ${key}`);
        if (sortable && sortable.destroy) {
            sortable.destroy();
        }
    });
    sortableInstances.value.clear();

    // Initialize parent sortable
    const parentSortable = initializeParentSortable();
    if (parentSortable) {
        sortableInstances.value.set('parent', parentSortable);
    }

    // Initialize children sortables
    masterDataList.value.forEach((parent) => {
        if (parent.children && parent.children.length > 0) {
            console.log(`📋 Initializing children sortable for: ${parent.name} (${parent.id})`);
            const childSortable = initializeChildrenSortable(parent.id);
            if (childSortable) {
                sortableInstances.value.set(`child-${parent.id}`, childSortable);
            }
        }
    });

    console.log('✅ All sortables initialized:', Array.from(sortableInstances.value.keys()));
};

// Set child sortable ref
const setChildSortableRef = (parentId, el) => {
    console.log(`📌 Setting child ref for ${parentId}:`, el);
    if (el) {
        childrenSortableRefs.value.set(parentId, el);
    }
};

const expandedRows = ref([]);

// Watch for expanded rows changes to initialize sortables
watch(
    expandedRows,
    async (newVal, oldVal) => {
        console.log('👁️ Expanded rows changed:', { newVal, oldVal });
        await nextTick();
        initializeSortables();
    },
    { deep: true }
);

onMounted(() => {
    console.log('🎯 Component mounted');
    fetchData();
    fetchBuilding();
});

watch(
    () => filters.value.global.value,
    (val) => {
        lazyParams.value.search = val;
        lazyParams.value.page = 1;
        fetchData();
    }
);

onUnmounted(() => {
    if (reorderTimeout) {
        clearTimeout(reorderTimeout);
    }
    // Cleanup sortable instances
    sortableInstances.value.forEach((sortable) => {
        if (sortable && sortable.destroy) {
            sortable.destroy();
        }
    });
    sortableInstances.value.clear();
});
</script>

<template>
    <div>
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <Button label="Thêm" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew" />
                    <Button label="Xoá" icon="pi pi-trash" severity="secondary" @click="confirmDeleteSelected" :disabled="!selectedItems || !selectedItems.length" />
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                :value="masterDataList"
                v-model:selection="selectedItems"
                dataKey="id"
                :paginator="true"
                :rows="lazyParams.limit"
                :first="(lazyParams.page - 1) * lazyParams.limit"
                :totalRecords="totalRecords"
                :loading="false"
                :rowsPerPageOptions="[5, 10, 25]"
                stripedRows
                :filters="filters"
                @page="onPage"
                @sort="onSort"
                resizableColumns
                v-model:expandedRows="expandedRows"
                columnResizeMode="expand"
                lazy
                scrollable
                scrollDirection="horizontal"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Hiển thị {first} đến {last} của {totalRecords} phân khu"
                class="sortable-datatable"
                tableClass="sortable-table"
            >
                <template #header>
                    <div class="flex justify-between items-center">
                        <h4 class="m-0">Danh sách phân khu</h4>
                        <IconField>
                            <InputIcon><i class="pi pi-search" /></InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Tìm kiếm..." />
                        </IconField>
                    </div>
                </template>
                <template #empty>Không có dữ liệu</template>

                <!-- Drag handle column -->
                <Column style="width: 4rem">
                    <template #body="slotProps">
                        <div class="drag-handle-parent" :data-id="slotProps.data.id">
                            <i class="pi pi-bars cursor-grab hover:text-primary-500 transition-colors duration-200 text-lg"></i>
                        </div>
                    </template>
                </Column>

                <!-- Expand column -->
                <Column expander style="width: 3rem" />
                <Column field="name" header="Phân khu" sortable>
                    <template #body="slotProps">
                        <span class="font-medium">{{ slotProps.data.name }}</span>
                    </template>
                </Column>

                <Column :exportable="false" headerStyle="min-width:10rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" outlined rounded size="small" class="mr-2" @click="editItem(slotProps.data)" />
                        <Button icon="pi pi-trash" outlined rounded severity="danger" size="small" @click="confirmDeleteItem(slotProps.data)" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4 bg-gray-50 rounded-lg">
                        <h5 class="text-primary-600 mb-4 font-semibold">Loại căn hộ của {{ slotProps.data.name }}</h5>

                        <div v-if="slotProps.data.children && slotProps.data.children.length > 0" :ref="(el) => setChildSortableRef(slotProps.data.id, el)" class="sortable-children-container">
                            <div
                                v-for="(child, index) in slotProps.data.children"
                                :key="child.id"
                                :data-id="child.id"
                                class="sortable-child-item bg-white rounded-lg shadow-sm border border-gray-200 mb-3 p-4 hover:shadow-md transition-shadow duration-200"
                            >
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-4">
                                        <div class="drag-handle-child">
                                            <i class="pi pi-bars cursor-grab hover:text-primary-500 transition-colors duration-200 text-base text-gray-400"></i>
                                        </div>
                                        <div class="flex items-center space-x-3">
                                            <span class="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                                                {{ child.order || index + 1 }}
                                            </span>
                                            <span class="font-medium text-gray-900">{{ child.name }}</span>
                                        </div>
                                    </div>
                                    <div class="flex space-x-2">
                                        <Button icon="pi pi-pencil" outlined rounded size="small" @click="editItem(child)" />
                                        <Button icon="pi pi-trash" outlined rounded severity="danger" size="small" @click="confirmDeleteItem(child)" />
                                    </div>
                                </div>
                                <div v-if="child.description" class="mt-2 ml-10 text-sm text-gray-600">
                                    {{ child.description }}
                                </div>
                            </div>
                        </div>

                        <div v-else class="text-center py-8 text-gray-500">
                            <i class="pi pi-inbox text-3xl mb-2"></i>
                            <p>Chưa có loại căn hộ nào</p>
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>

        <!-- Dialog thêm/sửa -->
        <Dialog v-model:visible="masterDataDialog" header="Thông tin Master Data" class="w-[90vw] sm:w-[400px] md:w-[500px]" modal>
            <div class="flex flex-col gap-4">
                <div>
                    <label class="font-semibold block mb-2 text-gray-700">Tòa nhà</label>
                    <Select v-model="item.parentId" :options="buildings" optionLabel="name" optionValue="id" placeholder="Chọn tòa nhà (tùy chọn)" class="w-full" showClear />
                    <small class="text-gray-500">Để trống nếu đây là phân khu chính</small>
                </div>

                <div>
                    <label class="font-semibold block mb-2 text-gray-700">Tên <span class="text-red-500">*</span></label>
                    <InputText v-model="item.name" class="w-full" :invalid="submitted && !item.name?.trim()" placeholder="Nhập tên phân khu/loại căn hộ" />
                    <small v-if="submitted && !item.name?.trim()" class="text-red-500">Vui lòng nhập tên.</small>
                </div>

                <div>
                    <label class="font-semibold block mb-2 text-gray-700">Ghi chú</label>
                    <Textarea v-model="item.description" rows="3" class="w-full" placeholder="Nhập ghi chú (tùy chọn)" />
                </div>
            </div>
            <template #footer>
                <Button label="Huỷ" icon="pi pi-times" text @click="hideDialog" />
                <Button label="Lưu" icon="pi pi-check" @click="saveItem" :loading="submitted" />
            </template>
        </Dialog>

        <!-- Dialog xác nhận xoá -->
        <Dialog v-model:visible="deleteDialog" header="Xác nhận xoá" class="w-[90vw] sm:w-[400px]" modal>
            <div class="flex items-center mb-4">
                <i class="pi pi-exclamation-triangle text-orange-500 text-2xl mr-3"></i>
                <span
                    >Bạn có chắc chắn muốn xoá <strong>{{ item.name }}</strong
                    >?</span
                >
            </div>
            <template #footer>
                <Button label="Hủy" icon="pi pi-times" text @click="deleteDialog = false" />
                <Button label="Xoá" icon="pi pi-check" severity="danger" @click="deleteItem" />
            </template>
        </Dialog>

        <!-- Dialog xoá nhiều -->
        <Dialog v-model:visible="deleteMultiDialog" header="Xác nhận xoá" class="w-[90vw] sm:w-[400px]" modal>
            <div class="flex items-center mb-4">
                <i class="pi pi-exclamation-triangle text-orange-500 text-2xl mr-3"></i>
                <span
                    >Bạn có chắc chắn muốn xoá <strong>{{ selectedItems?.length }}</strong> mục đã chọn?</span
                >
            </div>
            <template #footer>
                <Button label="Hủy" icon="pi pi-times" text @click="deleteMultiDialog = false" />
                <Button label="Xoá" icon="pi pi-check" severity="danger" @click="deleteSelectedItems" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* Sortable.js Styles - Chỉ hiển thị fallback, ẩn ghost */
.sortable-ghost {
    opacity: 0 !important;
    visibility: hidden !important;
    display: none !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
}

.sortable-drag {
    transform: rotate(3deg);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    opacity: 1 !important;
}

.sortable-chosen {
    cursor: grabbing !important;
    opacity: 0.5 !important; /* Làm mờ element gốc */
}

.sortable-fallback {
    opacity: 1 !important;
    transform: rotate(5deg) !important;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2) !important;
    z-index: 9999 !important;
    background: white !important;
    border: 2px solid #3b82f6 !important;
}

/* Custom drag handles */
.drag-handle-parent,
.drag-handle-child {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    cursor: grab;
    user-select: none;
}

.drag-handle-parent:active,
.drag-handle-child:active {
    cursor: grabbing;
}

/* Improved DataTable styles */
.sortable-datatable :deep(.p-datatable-tbody > tr) {
    transition: all 0.2s ease;
    opacity: 1 !important;
    background: white !important;
}

.sortable-datatable :deep(.p-datatable-tbody > tr:hover) {
    background-color: #f8fafc !important;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    opacity: 1 !important;
}

/* Fix any disabled/muted states */
.sortable-datatable :deep(.p-datatable-tbody > tr td) {
    opacity: 1 !important;
    color: inherit !important;
}

.sortable-datatable :deep(.p-datatable-tbody > tr.p-disabled) {
    opacity: 1 !important;
}

/* Remove any overlay that might cause opacity issues */
.sortable-datatable :deep(.p-datatable-loading-overlay) {
    display: none !important;
}

/* Children container styles */
.sortable-children-container {
    max-height: 400px;
    overflow-y: auto;
    padding: 4px;
}

.sortable-child-item {
    transition: all 0.2s ease;
}

.sortable-child-item:hover {
    transform: translateY(-1px);
}

.sortable-child-item.sortable-ghost {
    opacity: 0 !important;
    visibility: hidden !important;
    display: none !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
}

.sortable-child-item.sortable-chosen {
    opacity: 0.5 !important; /* Làm mờ element gốc */
    cursor: grabbing !important;
}

.sortable-child-item.sortable-fallback {
    opacity: 1 !important;
    transform: rotate(3deg) !important;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15) !important;
    z-index: 9999 !important;
    background: white !important;
    border: 2px solid #3b82f6 !important;
}

.sortable-child-item.sortable-drag {
    transform: rotate(2deg);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    opacity: 1 !important;
}

/* Remove any loading/overlay effects that cause opacity */
.sortable-datatable :deep(.p-datatable-loading-overlay) {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
}

.sortable-datatable :deep(.p-datatable-mask) {
    display: none !important;
}

/* Force normal state for all table elements */
.sortable-datatable :deep(.p-datatable-table) {
    opacity: 1 !important;
}

.sortable-datatable :deep(.p-datatable-tbody) {
    opacity: 1 !important;
}

/* Ensure drag handles are visible and interactive */
.drag-handle-parent,
.drag-handle-child {
    opacity: 1 !important;
    pointer-events: auto !important;
    visibility: visible !important;
}

/* Responsive improvements */
@media (max-width: 768px) {
    .drag-handle-parent i,
    .drag-handle-child i {
        font-size: 1.25rem;
    }

    .sortable-child-item {
        padding: 12px;
    }
}

/* Custom scrollbar for children container */
.sortable-children-container::-webkit-scrollbar {
    width: 6px;
}

.sortable-children-container::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.sortable-children-container::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.sortable-children-container::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

/* Hover effect cho rows - đảm bảo không bị mờ */
.sortable-datatable :deep(.p-datatable-tbody > tr:hover) {
    background: #f8fafc !important;
    opacity: 1 !important;
}

/* Override any disabled states */
.sortable-datatable :deep(.p-disabled) {
    opacity: 1 !important;
    pointer-events: auto !important;
}
</style>