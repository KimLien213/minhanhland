<script setup>
import { departmentService } from '@/service/DepartmentService';
import { userService } from '@/service/UserService';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';

onMounted(() => {
    fetchUsers();
    fetchDepartments();
});

const toast = useToast();
const dt = ref();
const departments = ref();
const departmentDialog = ref(false);
const deleteDepartmentDialog = ref(false);
const deleteDepartmentsDialog = ref(false);
const department = ref({});
const selectedDepartments = ref();
const allUsers = ref([]);
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});
const submitted = ref(false);

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
    fetchDepartments();
}

function onSort(event) {
    lazyParams.value.sortBy = event.sortField;
    lazyParams.value.sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';
    fetchDepartments();
}
const fetchDepartments = async () => {
    loading.value = true;
    try {
        const res = await departmentService.getAll(lazyParams.value);
        departments.value = res.data.map((d) => ({
            ...d,
            headName: d.head?.fullName || ''
        }));
        totalRecords.value = res.meta.total;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'Không tải được danh sách phòng ban' });
    } finally {
        loading.value = false;
    }
};

const fetchUsers = async () => {
    try {
        allUsers.value = await userService.getAllNoPaging();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được người dùng', life: 1000 });
    }
};

function openNew() {
    department.value = {};
    submitted.value = false;
    departmentDialog.value = true;
}

function hideDialog() {
    departmentDialog.value = false;
    submitted.value = false;
}

watch(
    () => filters.value.global.value,
    (val) => {
        lazyParams.value.search = val;
        lazyParams.value.page = 1;
        fetchDepartments();
    }
);

const saveDepartment = async () => {
    submitted.value = true;
    if (!department.value.name) return;

    try {
        if (department.value.id) {
            await departmentService.update(department.value.id, department.value);
            toast.add({ severity: 'success', summary: 'Cập nhật thành công', detail: department.value.name });
        } else {
            await departmentService.create(department.value);
            toast.add({ severity: 'success', summary: 'Tạo thành công', detail: department.value.name });
        }

        departmentDialog.value = false;
        fetchDepartments();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: err.response?.data?.message || 'Lưu thất bại' });
    }
};

function editDepartment(prod) {
    department.value = { ...prod };
    departmentDialog.value = true;
}

function confirmDeleteDepartment(prod) {
    department.value = prod;
    deleteDepartmentDialog.value = true;
}

async function deleteDepartment() {
    try {
        await departmentService.remove(department.value.id);
        toast.add({ severity: 'success', summary: 'Đã xoá', detail: department.value.name });
        deleteDepartmentDialog.value = false;
        fetchDepartments();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xoá phòng ban' });
    }
}
function confirmDeleteSelected() {
    deleteDepartmentsDialog.value = true;
}

async function deleteSelectedDepartments() {
    try {
        await Promise.all(selectedDepartments.value.map((d) => departmentService.remove(d.id)));
        toast.add({ severity: 'success', summary: 'Đã xoá', detail: 'Nhiều phòng ban đã bị xoá' });
        fetchDepartments();
        deleteDepartmentsDialog.value = false;
        selectedDepartments.value = null;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Xoá thất bại' });
    }
}
</script>

<template>
    <div>
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <Button label="Thêm" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew" />
                    <Button label="Xóa" icon="pi pi-trash" severity="secondary" @click="confirmDeleteSelected" :disabled="!selectedDepartments || !selectedDepartments.length" />
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                v-model:selection="selectedDepartments"
                :value="departments"
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
                currentPageReportTemplate="Hiển thị {first} đến {last} của {totalRecords} phòng ban"
            >
                <template #empty>
                    <span>Không có phòng ban nào</span>
                </template>
                <template #paginatorstart>
                    <Button type="button" @click="fetchDepartments" icon="pi pi-refresh" text />
                </template>
                <template #header>
                    <div class="flex flex-wrap gap-2 items-center justify-between">
                        <h4 class="m-0">Quản lý phòng ban</h4>
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Tìm kiếm..." />
                        </IconField>
                    </div>
                </template>

                <Column selectionMode="multiple" style="width: 3rem" :exportable="false"></Column>
                <Column field="name" header="Tên phòng ban" sortable style="min-width: 5rem"></Column>
                <Column field="headName" header="Trưởng phòng" sortable style="min-width: 7rem"></Column>
                <Column field="description" header="Mô tả" sortable></Column>
                <Column :exportable="false" style="min-width: 12rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editDepartment(slotProps.data)" />
                        <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteDepartment(slotProps.data)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="departmentDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Thông tin department" :modal="true">
            <div class="flex flex-col gap-6">
                <img v-if="department.image" :src="`https://primefaces.org/cdn/primevue/images/department/${department.image}`" :alt="department.image" class="block m-auto pb-4" />
                <div>
                    <label for="name" class="block font-bold mb-3">Tên phòng ban</label>
                    <InputText id="name" v-model.trim="department.name" required="true" autofocus :invalid="submitted && !department.name" fluid />
                    <small v-if="submitted && !department.name" class="text-red-500">Vui lòng nhập tên phòng ban.</small>
                </div>
                <div>
                    <label for="headName" class="block font-bold mb-3">Trưởng phòng</label>
                    <Select v-model="department.headId" :options="allUsers" optionLabel="fullName" optionValue="id" class="w-full" />
                </div>
                <div>
                    <label for="description" class="block font-bold mb-3">Mô tả</label>
                    <Textarea id="description" v-model="department.description" required="true" rows="3" cols="20" fluid />
                </div>
            </div>

            <template #footer>
                <Button label="Hủy" icon="pi pi-times" text @click="hideDialog" />
                <Button label="Lưu" icon="pi pi-check" @click="saveDepartment" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deleteDepartmentDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Confirm" :modal="true">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle !text-3xl" />
                <span v-if="department"
                    >Are you sure you want to delete <b>{{ department.name }}</b
                    >?</span
                >
            </div>
            <template #footer>
                <Button label="No" icon="pi pi-times" text @click="deleteDepartmentDialog = false" />
                <Button label="Yes" icon="pi pi-check" @click="deleteDepartment" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deleteDepartmentsDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Confirm" :modal="true">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle !text-3xl" />
                <span v-if="department">Are you sure you want to delete the selected departments?</span>
            </div>
            <template #footer>
                <Button label="No" icon="pi pi-times" text @click="deleteDepartmentsDialog = false" />
                <Button label="Yes" icon="pi pi-check" text @click="deleteSelectedDepartments" />
            </template>
        </Dialog>
    </div>
</template>
