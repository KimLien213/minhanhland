<script setup>
import { productFieldPermissionService } from '@/service/ProductFieldPermissionService';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref, watch } from 'vue';

const toast = useToast();
const dt = ref();
const permissions = ref([]);
const selectedPermissions = ref();
const permissionDialog = ref(false);
const deletePermissionDialog = ref(false);
const submitted = ref(false);
const userIdToDelete = ref(null);

const selectedUsers = ref([]);
const selectedFields = ref([]);
const allUsers = ref([]);
const allFields = ref([
    { value: 'buildingCode', label: 'Mã tòa' },
    { value: 'apartmentCode', label: 'Mã căn' },
    { value: 'apartmentEncode', label: 'Mã căn x' },
    { value: 'area', label: 'S (m2)', type: 's' },
    { value: 'sellingPrice', label: 'Giá bán' },
    { value: 'tax', label: 'Thuế phí' },
    { value: 'furnitureNote', label: 'Nội thất' },
    { value: 'mortgageInfo', label: 'TT Sổ đỏ + Vay' },
    { value: 'description', label: 'Lưu ý' },
    { value: 'balconyDirection', label: 'Ban công' },
    { value: 'updatedAt', label: 'Ngày cập nhật' },
    {
        value: 'imageList',
        label: 'Hình ảnh'
    },
    {
        value: 'status',
        label: 'Trạng thái'
    },
    { value: 'apartmentContactInfo', label: 'SĐT Liên hệ' },
    { value: 'contactInfo', label: 'Liên hệ' },
    { value: 'source', label: 'Báo nguồn' }
]);
function getFieldLabel(field) {
    const found = allFields.value.find((f) => f.value === field);
    return found ? found.label : field;
}
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const errors = reactive({});
const validateForm = () => {
    errors.selectedUsers = selectedUsers.value.length === 0 ? 'Vui lòng chọn người dùng' : '';
    errors.selectedFields = selectedFields.value.length === 0 ? 'Vui lòng chọn quyền' : '';
    return Object.values(errors).every((e) => !e);
};

onMounted(() => {
    fetchPermissions();
    fetchUsers();
});
watch(
    () => filters.value.global.value,
    (val) => {
        lazyParams.value.search = val;
        lazyParams.value.page = 1;
        fetchPermissions();
    }
);
const loading = ref(false);
const totalRecords = ref(0);
const fetchPermissions = async () => {
    loading.value = true;
    try {
        const res = await productFieldPermissionService.getAll(lazyParams.value);
        permissions.value = res.data;
        totalRecords.value = res.total;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được danh sách quyền', life: 1000 });
    } finally {
        loading.value = false;
    }
};

const fetchUsers = async () => {
    try {
        allUsers.value = await productFieldPermissionService.getUsers();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được người dùng', life: 1000 });
    }
};

function openNew() {
    selectedUsers.value = [];
    selectedFields.value = [];
    submitted.value = false;
    permissionDialog.value = true;
}

function hideDialog() {
    permissionDialog.value = false;
    submitted.value = false;
}

const savePermission = async () => {
    submitted.value = true;
    if (!validateForm()) return;

    try {
        await productFieldPermissionService.createBulk({
            userIds: selectedUsers.value.map((u) => u.id),
            fieldNames: selectedFields.value
        });
        toast.add({ severity: 'success', summary: 'Lưu quyền thành thành công', detail: 'Phân quyền đã được thêm', life: 1000 });
        permissionDialog.value = false;
        fetchPermissions();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: err.response?.data?.message || 'Lưu thất bại', life: 1000 });
    }
};

const lazyParams = ref({
    page: 1,
    limit: 10,
    sortBy: null,
    sortOrder: 'ASC',
    search: ''
});
function onPage(event) {
    lazyParams.value.page = event.page + 1;
    lazyParams.value.limit = event.rows;
    fetchPermissions();
}

function onSort(event) {
    lazyParams.value.sortBy = event.sortField;
    lazyParams.value.sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';
    fetchPermissions();
}
function editPermission(row) {
    selectedUsers.value = [row.user];
    selectedFields.value = [...row.fieldNames];
    permissionDialog.value = true;
}
const confirmDeleteUserPermissions = (userId) => {
    userIdToDelete.value = userId;
    deletePermissionDialog.value = true;
};
const removeByUser = async () => {
    try {
        await productFieldPermissionService.removeByUser(userIdToDelete.value);
        toast.add({ severity: 'success', summary: 'Xoá thành công', detail: 'Đã xoá quyền của người dùng', life: 1000 });
        deletePermissionDialog.value = false;
        fetchPermissions();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xoá quyền', life: 1000 });
    }
};
</script>

<template>
    <div>
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <Button label="Thêm" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew" />
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                v-model:selection="selectedPermissions"
                :value="permissions"
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
                filterDisplay="menu"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Hiển thị {first} đến {last} của {totalRecords} phân quyền"
            >
                <template #header>
                    <div class="flex flex-wrap gap-2 items-center justify-between">
                        <h4 class="m-0">Phân quyền</h4>
                        <IconField>
                            <InputIcon>
                                <i class="pi pi-search" />
                            </InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Tìm kiếm..." />
                        </IconField>
                    </div>
                </template>

                <template #empty><span>Không có phân quyền nào</span></template>
                <template #paginatorstart>
                    <Button type="button" @click="fetchPermissions" icon="pi pi-refresh" text />
                </template>

                <Column selectionMode="multiple" style="width: 3rem" :exportable="false" />
                <Column field="user.fullName" header="Người dùng" sortable style="min-width: 10rem" />
                <Column field="fieldNames" header="Cột không được xem" style="min-width: 13rem">
                    <template #body="slotProps">
                        <div class="flex flex-wrap gap-2">
                            <Tag v-for="field in slotProps.data.fieldNames" :key="field" :value="getFieldLabel(field)" class="mr-1" />
                        </div>
                    </template>
                </Column>
                <Column header="Hành động">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" text rounded @click="editPermission(slotProps.data)" />
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmDeleteUserPermissions(slotProps.data.user.id)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="permissionDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Phân quyền" modal>
            <form @submit.prevent="savePermission">
                <div class="flex flex-col gap-6">
                    <div>
                        <label class="block font-bold mb-3">Người dùng</label>
                        <MultiSelect class="w-full" v-model="selectedUsers" :options="allUsers" :invalid="!!errors.selectedUsers" optionLabel="fullName" placeholder="Chọn người dùng" filter display="chip" />
                        <small v-if="errors.selectedUsers" class="text-red-500">{{ errors.selectedUsers }}</small>
                    </div>

                    <div>
                        <label class="block font-bold mb-3">Cột không được xem</label>
                        <MultiSelect class="w-full" :invalid="!!errors.selectedFields" v-model="selectedFields" :options="allFields" optionLabel="label" optionValue="value" placeholder="Chọn field" display="chip" />
                        <small v-if="errors.selectedFields" class="text-red-500">{{ errors.selectedFields }}</small>
                    </div>
                </div>
            </form>
            <template #footer>
                <Button label="Hủy" icon="pi pi-times" text @click="hideDialog" />
                <Button label="Lưu" icon="pi pi-check" type="submit" @click="savePermission" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deletePermissionDialog" header="Xác nhận xoá" :modal="true" class="w-[90vw] sm:w-[350px] md:w-[450px]">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle !text-3xl" />
                <span>Bạn có chắc chắn muốn xoá tất cả quyền xem của người dùng này?</span>
            </div>
            <template #footer>
                <Button label="Không" icon="pi pi-times" text @click="deletePermissionDialog = false" />
                <Button label="Xoá" icon="pi pi-check" severity="danger" @click="removeByUser" />
            </template>
        </Dialog>
    </div>
</template>
