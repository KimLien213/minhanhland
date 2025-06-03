<script setup>
import { masterDataService } from '@/service/MasterDataService';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, onUnmounted, ref, watch } from 'vue';

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

const fetchData = async () => {
    loading.value = true;
    try {
        const res = await masterDataService.getAll(lazyParams.value);
        masterDataList.value = res.data.data;
        totalRecords.value = res.data.meta.total;
    } catch (err) {
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
    if (!item.value.name) return;
    try {
        if (item.value.id) {
            await masterDataService.update(item.value.id, item.value);
            toast.add({ severity: 'success', summary: 'Đã cập nhật', detail: item.value.value });
        } else {
            await masterDataService.create(item.value);
            toast.add({ severity: 'success', summary: 'Đã Thêm', detail: item.value.value });
        }
        masterDataDialog.value = false;
        fetchData();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể lưu' });
    }
};

const editItem = (data) => {
    item.value = { ...data };
    masterDataDialog.value = true;
};

const confirmDeleteItem = (data) => {
    item.value = data;
    deleteDialog.value = true;
};

const deleteItem = async () => {
    try {
        await masterDataService.remove(item.value.id);
        toast.add({ severity: 'success', summary: 'Đã xoá', detail: item.value.value });
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

onMounted(() => {
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

const handleReorder = async (items, isChildren = false, parentId = null) => {
    // Hiển thị loading state
    loading.value = true;

    try {
        // Tạo mảng với id và order mới
        const reorderItems = items.map((item, index) => ({
            id: item.id,
            order: index + 1
        }));

        // Gọi API để cập nhật thứ tự
        await masterDataService.reorder(reorderItems);

        toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: `Đã cập nhật thứ tự ${isChildren ? 'loại căn hộ' : 'phân khu'}`
        });

        // Refresh data để hiển thị thứ tự mới
        await fetchData();
    } catch (err) {
        console.error('Lỗi reorder:', err);
        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Không thể cập nhật thứ tự'
        });
        // Refresh để reset về trạng thái cũ
        await fetchData();
    } finally {
        loading.value = false;
    }
};

// Debounce để tránh call API quá nhiều lần
let reorderTimeout = null;
const debouncedReorder = (items, isChildren = false, parentId = null) => {
    if (reorderTimeout) {
        clearTimeout(reorderTimeout);
    }

    reorderTimeout = setTimeout(() => {
        handleReorder(items, isChildren, parentId);
    }, 300); // Đợi 300ms sau lần drag cuối cùng
};

function onRowReorder(event) {
    console.log('Parent reorder:', event);
    // Cập nhật local state ngay lập tức để UI responsive
    masterDataList.value = [...event.value];

    // Gọi API với debounce
    debouncedReorder(event.value, false);
}

function onRowReorderChildren(event, parentId) {
    console.log('Children reorder:', event, 'Parent ID:', parentId);

    // Tìm parent và cập nhật children local state
    const parentIndex = masterDataList.value.findIndex((p) => p.id === parentId);
    if (parentIndex !== -1) {
        masterDataList.value[parentIndex].children = [...event.value];
    }

    // Gọi API với debounce
    debouncedReorder(event.value, true, parentId);
}

// Thêm method để clear timeout khi component unmount
onUnmounted(() => {
    if (reorderTimeout) {
        clearTimeout(reorderTimeout);
    }
});

// Thêm reactive state cho loading
const isDragging = ref(false);

// Thêm methods để handle drag states
const onDragStart = () => {
    isDragging.value = true;
};

const onDragEnd = () => {
    isDragging.value = false;
};

const expandedRows = ref([]);
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
                :loading="loading"
                :rowsPerPageOptions="[5, 10, 25]"
                stripedRows
                :reorderableRows="true"
                @rowReorder="onRowReorder"
                :filters="filters"
                @page="onPage"
                @sort="onSort"
                resizableColumns
                v-model:expandedRows="expandedRows"
                columnResizeMode="expand"
                lazy
                reorderableColumns
                scrollable
                scrollDirection="horizontal"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Hiển thị {first} đến {last} của {totalRecords} quyền"
                class="reorderable-table"
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

                <!-- Cải thiện column reorder với style tốt hơn -->
                <Column rowReorder style="width: 4rem; padding: 8px">
                    <template #rowreordericon>
                        <i class="pi pi-bars text-lg cursor-grab hover:text-primary transition-colors" style="font-size: 1.2rem"></i>
                    </template>
                </Column>

                <!-- Nút mở rộng -->
                <Column expander style="width: 3rem" />

                <!-- Column STT để hiển thị thứ tự -->
                <Column header="STT" style="width: 5rem">
                    <template #body="slotProps">
                        <span class="font-semibold text-sm">
                            {{ slotProps.data.order || slotProps.index + 1 }}
                        </span>
                    </template>
                </Column>

                <Column field="name" header="Phân khu" sortable />

                <Column :exportable="false" headerStyle="min-width:10rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editItem(slotProps.data)" />
                        <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteItem(slotProps.data)" />
                    </template>
                </Column>

                <template #expansion="slotProps">
                    <div class="p-4">
                        <h5 class="text-primary mb-3">Loại căn hộ của {{ slotProps.data.name }}</h5>
                        <DataTable :value="slotProps.data.children" :reorderableRows="true" @rowReorder="(event) => onRowReorderChildren(event, slotProps.data.id)" class="reorderable-table children-table">
                            <!-- Cải thiện reorder cho children -->
                            <Column rowReorder style="width: 4rem; padding: 8px">
                                <template #rowreordericon>
                                    <i class="pi pi-bars text-lg cursor-grab hover:text-primary transition-colors" style="font-size: 1rem"></i>
                                </template>
                            </Column>

                            <!-- STT cho children -->
                            <Column header="STT" style="width: 5rem">
                                <template #body="childSlotProps">
                                    <span class="font-semibold text-sm">
                                        {{ childSlotProps.data.order || childSlotProps.index + 1 }}
                                    </span>
                                </template>
                            </Column>

                            <Column field="name" header="Loại" sortable />

                            <Column :exportable="false" headerStyle="min-width:10rem">
                                <template #body="slotProps">
                                    <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editItem(slotProps.data)" />
                                    <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteItem(slotProps.data)" />
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </template>
            </DataTable>
        </div>

        <!-- Dialog thêm/sửa -->
        <Dialog v-model:visible="masterDataDialog" header="Thông tin Master Data" class="w-[90vw] sm:w-[350px] md:w-[450px]" modal>
            <div class="flex flex-col gap-3">
                <div>
                    <label class="font-bold block mb-1">Tòa</label>
                    <Select v-model="item.parentId" :options="buildings" optionLabel="name" option-value="id" class="w-full" />
                </div>
                <div>
                    <label class="font-bold block mb-1">Loại</label>
                    <InputText v-model="item.name" class="w-full" :invalid="submitted && !item.name" />
                    <small v-if="submitted && !item.name" class="text-red-500">Vui lòng nhập loại.</small>
                </div>

                <div>
                    <label class="font-bold block mb-1">Ghi chú</label>
                    <Textarea v-model="item.description" rows="2" class="w-full" />
                </div>
            </div>
            <template #footer>
                <Button label="Huỷ" icon="pi pi-times" text @click="hideDialog" />
                <Button label="Lưu" icon="pi pi-check" @click="saveItem" />
            </template>
        </Dialog>

        <!-- Dialog xác nhận xoá -->
        <Dialog v-model:visible="deleteDialog" header="Xác nhận" class="w-[90vw] sm:w-[350px] md:w-[450px]" modal>
            <span
                >Bạn có chắc chắn muốn xoá <b>{{ item.value }}</b
                >?</span
            >
            <template #footer>
                <Button label="Không" icon="pi pi-times" text @click="deleteDialog = false" />
                <Button label="Xoá" icon="pi pi-check" @click="deleteItem" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deleteMultiDialog" header="Xác nhận" class="w-[90vw] sm:w-[350px] md:w-[450px]" modal>
            <span>Bạn có chắc chắn muốn xoá các dòng đã chọn?</span>
            <template #footer>
                <Button label="Không" icon="pi pi-times" text @click="deleteMultiDialog = false" />
                <Button label="Xoá" icon="pi pi-check" @click="deleteSelectedItems" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* CSS để cải thiện drag & drop experience */
.reorderable-table {
    /* Đảm bảo table có không gian đủ cho drag */
    min-height: 200px;
}

/* Cải thiện drag handle */
.reorderable-table :deep(.p-datatable-reorderablerow-handle) {
    cursor: grab !important;
    padding: 8px !important;
    color: #6b7280;
    transition: color 0.2s ease;
}

.reorderable-table :deep(.p-datatable-reorderablerow-handle:hover) {
    color: var(--primary-color) !important;
}

.reorderable-table :deep(.p-datatable-reorderablerow-handle:active) {
    cursor: grabbing !important;
}

/* Cải thiện feedback khi drag */
.reorderable-table :deep(.p-datatable-row.p-datatable-dragpoint-top) {
    border-top: 3px solid var(--primary-color) !important;
}

.reorderable-table :deep(.p-datatable-row.p-datatable-dragpoint-bottom) {
    border-bottom: 3px solid var(--primary-color) !important;
}

/* Style cho row đang được drag */
.reorderable-table :deep(.p-datatable-row.p-datatable-dragging) {
    opacity: 0.7 !important;
    background: var(--surface-100) !important;
    transform: rotate(2deg);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}

/* Cải thiện spacing cho children table */
.children-table {
    margin-top: 1rem;
}

.children-table :deep(.p-datatable-tbody > tr > td) {
    padding: 0.75rem 1rem;
}

/* Responsive improvements */
@media (max-width: 768px) {
    .reorderable-table :deep(.p-datatable-reorderablerow-handle) {
        padding: 12px 8px !important;
    }

    .reorderable-table :deep(.pi-bars) {
        font-size: 1.5rem !important;
    }
}

/* Hover effect cho rows */
.reorderable-table :deep(.p-datatable-tbody > tr:hover) {
    background: var(--surface-50) !important;
}

/* Loading state */
.reorderable-table :deep(.p-datatable-loading-overlay) {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(2px);
}
</style>
