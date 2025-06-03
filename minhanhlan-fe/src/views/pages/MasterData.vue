<script setup>
import { masterDataService } from '@/service/MasterDataService';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';

const toast = useToast();
const dt = ref();
const masterDataList = ref([]);
const masterDataDialog = ref(false);
const deleteDialog = ref(false);
const deleteMultiDialog = ref(false);
const selectedItems = ref();
const submitted = ref(false);
const item = ref({});
const expandedRows = ref({});
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const fetchData = async () => {
    loading.value = true;
    try {
        const res = await masterDataService.getAll(lazyParams.value);
        console.log('API Response:', res.data);

        masterDataList.value = res.data.data;
        totalRecords.value = res.data.meta.total;

        console.log('Master Data List:', masterDataList.value);
    } catch (err) {
        console.error('Fetch error:', err);
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
        console.log('Buildings:', buildings.value);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được dữ liệu' });
    }
};

const openNew = (parentId = null) => {
    item.value = { parentId };
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
            toast.add({ severity: 'success', summary: 'Đã cập nhật', detail: item.value.name });
        } else {
            await masterDataService.create(item.value);
            toast.add({ severity: 'success', summary: 'Đã Thêm', detail: item.value.name });
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
        const allSelected = [];
        selectedItems.value.forEach((selected) => {
            allSelected.push(selected);
            if (selected.children && selected.children.length > 0) {
                allSelected.push(...selected.children);
            }
        });
        await Promise.all(allSelected.map((i) => masterDataService.remove(i.id)));
        toast.add({ severity: 'success', summary: 'Đã xoá nhiều dòng' });
        selectedItems.value = null;
        deleteMultiDialog.value = false;
        fetchData();
    } catch {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xoá' });
    }
};

// FIXED: Reorder functions for parent items
const onParentRowReorder = async (event) => {
    console.log('Parent reorder event:', event);

    // Update local state immediately for better UX
    masterDataList.value = event.value;

    try {
        // Prepare order data for API
        const orderUpdates = event.value.map((item, index) => ({
            id: item.id,
            order: index + 1
        }));

        console.log('Saving parent order:', orderUpdates);

        // Call API to save order
        const response = await masterDataService.updateParentOrders(orderUpdates);

        if (response.data.success) {
            toast.add({
                severity: 'success',
                summary: 'Thành công',
                detail: 'Đã cập nhật thứ tự tòa nhà',
                life: 2000
            });
        } else {
            throw new Error('API returned success: false');
        }
    } catch (err) {
        console.error('Error saving parent order:', err);
        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Không thể cập nhật thứ tự. Đang tải lại dữ liệu...',
            life: 3000
        });

        // Revert changes and reload data
        await fetchData();
    }
};

// FIXED: Reorder functions for children items
const onChildRowReorder = async (event, parentIndex) => {
    console.log('Child reorder event:', event, 'Parent index:', parentIndex);

    // Update local state immediately
    if (masterDataList.value[parentIndex]) {
        const parentItem = masterDataList.value[parentIndex];
        const oldChildren = [...parentItem.children];

        // Update children array
        parentItem.children = event.value;

        // Force reactivity
        masterDataList.value = [...masterDataList.value];

        try {
            // Prepare order data for API
            const orderUpdates = event.value.map((child, index) => ({
                id: child.id,
                order: index + 1
            }));

            console.log('Saving children order for parent:', parentItem.id, orderUpdates);

            // Call API to save children order
            const response = await masterDataService.updateChildrenOrders(parentItem.id, orderUpdates);

            if (response.data.success) {
                toast.add({
                    severity: 'success',
                    summary: 'Thành công',
                    detail: 'Đã cập nhật thứ tự loại căn hộ',
                    life: 2000
                });
            } else {
                throw new Error('API returned success: false');
            }
        } catch (err) {
            console.error('Error saving children order:', err);
            toast.add({
                severity: 'error',
                summary: 'Lỗi',
                detail: 'Không thể cập nhật thứ tự. Đang khôi phục...',
                life: 3000
            });

            // Revert changes
            parentItem.children = oldChildren;
            masterDataList.value = [...masterDataList.value];
        }
    }
};

// Rest of your code...
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
</script>

<template>
    <div>
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <Button label="Thêm Tòa" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew()" />
                    <Button label="Xoá" icon="pi pi-trash" severity="secondary" @click="confirmDeleteSelected" :disabled="!selectedItems || !selectedItems.length" />
                </template>
                <template #end>
                    <div class="flex items-center gap-2">
                        <Tag value="Kéo thả để sắp xếp" severity="info" />
                        <i class="pi pi-arrows-v text-blue-500"></i>
                    </div>
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                :value="masterDataList"
                v-model:selection="selectedItems"
                v-model:expandedRows="expandedRows"
                dataKey="id"
                :paginator="true"
                :rows="lazyParams.limit"
                :first="(lazyParams.page - 1) * lazyParams.limit"
                :totalRecords="totalRecords"
                :loading="loading"
                :rowsPerPageOptions="[5, 10, 25]"
                stripedRows
                :filters="filters"
                @page="onPage"
                @sort="onSort"
                @rowReorder="onParentRowReorder"
                resizableColumns
                columnResizeMode="expand"
                lazy
                scrollable
                scrollDirection="horizontal"
                reorderableRows
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Hiển thị {first} đến {last} của {totalRecords} mục"
                class="reorderable-table"
            >
                <template #header>
                    <div class="flex justify-between items-center">
                        <h4 class="m-0">Danh sách loại căn hộ theo tòa</h4>
                        <IconField>
                            <InputIcon><i class="pi pi-search" /></InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Tìm kiếm..." />
                        </IconField>
                    </div>
                </template>
                <template #empty>Không có dữ liệu</template>

                <!-- IMPROVED: Row Reorder Handle with better styling -->
                <Column rowReorder headerStyle="width: 4rem; text-align: center;" bodyClass="reorder-handle">
                    <template #body>
                        <div class="reorder-grip">
                            <i class="pi pi-bars text-lg"></i>
                        </div>
                    </template>
                </Column>

                <!-- Selection Column -->
                <Column selectionMode="multiple" headerStyle="width: 3rem" />

                <!-- Row Expander Column -->
                <Column expander style="width: 5rem" />

                <!-- Name Column -->
                <Column field="name" header="Tên" sortable>
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-primary">{{ data.name }}</span>
                            <Tag value="Tòa" severity="info" />
                            <span v-if="data.children && data.children.length > 0" class="text-sm text-gray-500"> ({{ data.children.length }} loại căn hộ) </span>
                        </div>
                    </template>
                </Column>

                <!-- Description Column -->
                <Column field="description" header="Ghi chú" />

                <!-- Actions Column -->
                <Column :exportable="false" headerStyle="min-width:12rem">
                    <template #body="{ data }">
                        <div class="flex gap-2">
                            <Button icon="pi pi-plus" outlined rounded size="small" severity="success" @click="openNew(data.id)" v-tooltip.top="'Thêm loại căn hộ'" />
                            <Button icon="pi pi-pencil" outlined rounded size="small" @click="editItem(data)" />
                            <Button icon="pi pi-trash" outlined rounded size="small" severity="danger" @click="confirmDeleteItem(data)" />
                        </div>
                    </template>
                </Column>

                <!-- IMPROVED: Row Expansion Template with better children reorder -->
                <template #expansion="{ data, index: parentIndex }">
                    <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div class="flex justify-between items-center mb-4">
                            <h5 class="text-primary mb-0 font-semibold">Loại căn hộ trong {{ data.name }}</h5>
                            <div class="flex items-center gap-2">
                                <Tag value="Kéo thả để sắp xếp loại căn hộ" severity="success" size="small" />
                                <i class="pi pi-arrows-v text-green-500"></i>
                            </div>
                        </div>

                        <div v-if="!data.children || data.children.length === 0" class="text-gray-500 italic text-center py-4 bg-white rounded border-2 border-dashed border-gray-300">Chưa có loại căn hộ nào. Nhấn nút "+" để thêm.</div>

                        <DataTable v-else :value="data.children" dataKey="id" size="small" reorderableRows @rowReorder="(event) => onChildRowReorder(event, parentIndex)" class="children-reorderable-table">
                            <!-- IMPROVED: Child Row Reorder Handle -->
                            <Column rowReorder headerStyle="width: 4rem; text-align: center;" bodyClass="reorder-handle">
                                <template #body>
                                    <div class="reorder-grip children-grip">
                                        <i class="pi pi-bars text-sm"></i>
                                    </div>
                                </template>
                            </Column>

                            <!-- Child Name -->
                            <Column field="name" header="Tên loại căn hộ">
                                <template #body="{ data: child }">
                                    <div class="flex items-center gap-2">
                                        <i class="pi pi-home text-sm text-green-600"></i>
                                        <span>{{ child.name }}</span>
                                        <Tag value="Loại căn hộ" severity="success" size="small" />
                                    </div>
                                </template>
                            </Column>

                            <!-- Child Description -->
                            <Column field="description" header="Ghi chú" />

                            <!-- Child Actions -->
                            <Column :exportable="false" style="width: 8rem">
                                <template #body="{ data: child }">
                                    <div class="flex gap-2">
                                        <Button icon="pi pi-pencil" outlined rounded size="small" @click="editItem(child)" />
                                        <Button icon="pi pi-trash" outlined rounded size="small" severity="danger" @click="confirmDeleteItem(child)" />
                                    </div>
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
                <div v-if="!item.parentId">
                    <label class="font-bold block mb-1">Loại</label>
                    <div class="p-3 bg-blue-50 rounded border">
                        <span class="text-blue-700 font-semibold">Tòa nhà</span>
                    </div>
                </div>
                <div v-else>
                    <label class="font-bold block mb-1">Thuộc tòa</label>
                    <Select v-model="item.parentId" :options="buildings.filter((b) => !b.parentId)" optionLabel="name" optionValue="id" class="w-full" disabled />
                </div>

                <div>
                    <label class="font-bold block mb-1">Tên <span class="text-red-500">*</span></label>
                    <InputText v-model="item.name" class="w-full" :invalid="submitted && !item.name" />
                    <small v-if="submitted && !item.name" class="text-red-500">Vui lòng nhập tên.</small>
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

        <!-- Các Dialog khác giữ nguyên -->
        <Dialog v-model:visible="deleteDialog" header="Xác nhận" class="w-[90vw] sm:w-[350px] md:w-[450px]" modal>
            <span
                >Bạn có chắc chắn muốn xoá <b>{{ item.name }}</b
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
/* Enhanced reorder grip styling */
:deep(.reorder-handle) {
    text-align: center !important;
    vertical-align: middle !important;
    padding: 0.75rem !important;
}

.reorder-grip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    cursor: grab;
    color: var(--surface-400);
    transition: all 0.2s ease;
    padding: 0.5rem;
    border-radius: 4px;
}

.reorder-grip:hover {
    background-color: var(--surface-200);
    color: var(--primary-color);
    transform: scale(1.1);
}

.reorder-grip:active {
    cursor: grabbing;
    background-color: var(--primary-100);
    color: var(--primary-600);
}

/* Children table specific styling */
.children-grip {
    background-color: var(--green-50);
    border: 1px solid var(--green-200);
}

.children-grip:hover {
    background-color: var(--green-100);
    color: var(--green-600);
}

/* Enhanced row expansion styling */
:deep(.p-datatable-row-expansion) {
    background: var(--surface-50) !important;
    border: none !important;
}

:deep(.children-reorderable-table) {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.children-reorderable-table .p-datatable-tbody > tr) {
    transition: all 0.2s ease;
}

:deep(.children-reorderable-table .p-datatable-tbody > tr:hover) {
    background-color: var(--green-50) !important;
}

/* Improved reorder indicators */
:deep(.p-datatable-reorder-indicator-up),
:deep(.p-datatable-reorder-indicator-down) {
    background-color: var(--primary-color) !important;
    height: 4px !important;
    border-radius: 2px !important;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

/* Enhanced drag styling */
:deep(.p-datatable-tbody > tr.p-row-reorder-drag) {
    background: var(--primary-50) !important;
    opacity: 0.8 !important;
    transform: scale(1.02) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
    border: 2px solid var(--primary-200) !important;
}

/* Mobile responsiveness for reorder */
@media (max-width: 768px) {
    .reorder-grip {
        padding: 0.75rem;
    }

    .reorder-grip i {
        font-size: 1.2rem;
    }

    :deep(.reorder-handle) {
        width: 3rem !important;
        min-width: 3rem !important;
    }
}

/* Accessibility improvements */
:deep(.p-row-reorder-icon) {
    transition: all 0.2s ease;
}

:deep(.p-datatable-tbody > tr:hover .p-row-reorder-icon) {
    color: var(--primary-color) !important;
    transform: scale(1.2);
}

/* Loading state for reorder operations */
:deep(.p-datatable-loading-overlay) {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(2px);
}
</style>