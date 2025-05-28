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
                :filters="filters"
                @page="onPage"
                @sort="onSort"
                resizableColumns
                columnResizeMode="expand"
                lazy
                reorderableColumns
                scrollable
                scrollDirection="horizontal"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Hiển thị {first} đến {last} của {totalRecords} quyền"
            >
                <template #header>
                    <div class="flex justify-between items-center">
                        <h4 class="m-0">Danh sách loại căn hộ</h4>
                        <IconField>
                            <InputIcon><i class="pi pi-search" /></InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Tìm kiếm..." />
                        </IconField>
                    </div>
                </template>
                <template #empty>Không có dữ liệu</template>

                <Column selectionMode="multiple" headerStyle="width: 3rem" />
                <Column field="name" header="Loại" sortable />
                <Column field="parent.name" header="Phân khu" sortable />
                <Column field="description" header="Ghi chú" />
                <Column :exportable="false" headerStyle="min-width:10rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editItem(slotProps.data)" />
                        <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteItem(slotProps.data)" />
                    </template>
                </Column>
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
