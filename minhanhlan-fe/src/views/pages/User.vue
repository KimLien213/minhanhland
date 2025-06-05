<script setup>
import { departmentService } from '@/service/DepartmentService';
import { userService } from '@/service/UserService';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';

onMounted(() => {
    fetchDepartments();
    fetchUsers();
});

const toast = useToast();
const dt = ref();
const users = ref([]);
const userDialog = ref(false);
const deleteUserDialog = ref(false);
const deleteUsersDialog = ref(false);
const user = ref({});
const selectedUsers = ref();
const departments = ref([]);

const roleOptions = [
    { label: 'Quản trị viên', value: 'ADMIN' },
    { label: 'Nhân viên', value: 'USER' }
];

const seniorityOptions = [
    { label: 'Dưới 1 năm', value: 'DUOI_1_NAM' },
    { label: '1 năm', value: '1_NAM' },
    { label: '2 năm', value: '2_NAM' },
    { label: '3 năm', value: '3_NAM' },
    { label: '4 năm', value: '4_NAM' },
    { label: '5 năm', value: '5_NAM' },
    { label: 'Trên 5 năm', value: 'TREN_5_NAM' }
];

const selectedFile = ref(null);

function getRoleLabel(value) {
    return roleOptions.find((r) => r.value === value)?.label || value;
}

async function fetchDepartments() {
    const res = await departmentService.getAllNoPaging();
    departments.value = res.data;
}

function getSeniorityLabel(value) {
    return seniorityOptions.find((s) => s.value === value)?.label || value;
}

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const submitted = ref(false);

watch(
    () => filters.value.global.value,
    (val) => {
        lazyParams.value.search = val;
        lazyParams.value.page = 1;
        fetchUsers();
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
    fetchUsers();
}

function onSort(event) {
    lazyParams.value.sortBy = event.sortField;
    lazyParams.value.sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';
    fetchUsers();
}

const fetchUsers = async () => {
    try {
        const res = await userService.getAll(lazyParams.value);
        users.value = res.data.map((u) => ({
            ...u,
            headName: u.department?.head?.fullName || '-'
        }));
        totalRecords.value = res.meta.total;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được danh sách nhân viên' });
    }
};

function openNew() {
    user.value = {};
    avatarUrl.value = null;
    submitted.value = false;
    userDialog.value = true;
}

function hideDialog() {
    userDialog.value = false;
    submitted.value = false;
}

const saveUser = async () => {
    submitted.value = true;

    // Validation for new user
    if (!user.value.id) {
        if (!user.value.fullName || !user.value.username || !user.value.password || !user.value.role) {
            return;
        }
    } else {
        // Validation for existing user (password is optional)
        if (!user.value.fullName || !user.value.username || !user.value.role) {
            return;
        }
    }

    if (user.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.value.email)) {
        return;
    }

    try {
        const formData = new FormData();

        if (selectedFile.value) {
            formData.append('file', selectedFile.value);
        }

        formData.append('fullName', user.value.fullName);
        formData.append('username', user.value.username);

        // Only append password if it's provided (for new users, always required; for updates, optional)
        if (user.value.password && user.value.password.trim() !== '') {
            formData.append('password', user.value.password);
        }

        if (user.value.departmentId) {
            formData.append('departmentId', user.value.departmentId);
        }
        if (user.value.seniority) {
            formData.append('seniority', user.value.seniority);
        }
        if (user.value.email) {
            formData.append('email', user.value.email);
        }
        if (user.value.note) {
            formData.append('note', user.value.note);
        }
        formData.append('role', user.value.role);

        if (user.value.id) {
            await userService.update(user.value.id, formData);
            toast.add({
                severity: 'success',
                summary: 'Cập nhật thành công',
                detail: user.value.fullName
            });
        } else {
            await userService.create(formData);
            toast.add({
                severity: 'success',
                summary: 'Tạo thành công',
                detail: user.value.fullName
            });
        }

        userDialog.value = false;
        fetchUsers();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: err.response?.data?.message || 'Lưu thất bại'
        });
    }
};

function editUser(row) {
    user.value = { ...row };
    user.value.departmentId = row.department?.id;
    user.value.password = ''; // Clear password field for security
    avatarUrl.value = getImageUrl(user.value.avatarUrl);
    userDialog.value = true;
}

function confirmDeleteUser(row) {
    user.value = row;
    deleteUserDialog.value = true;
}

async function deleteUser() {
    try {
        await userService.remove(user.value.id);
        toast.add({ severity: 'success', summary: 'Đã xoá', detail: user.value.fullName });
        deleteUserDialog.value = false;
        fetchUsers();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xoá nhân viên' });
    }
}

function confirmDeleteSelected() {
    deleteUsersDialog.value = true;
}

async function deleteSelectedUsers() {
    try {
        await Promise.all(selectedUsers.value.map((u) => userService.remove(u.id)));
        toast.add({ severity: 'success', summary: 'Đã xoá', detail: 'Đã xoá nhiều nhân viên' });
        fetchUsers();
        deleteUsersDialog.value = false;
        selectedUsers.value = null;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xoá các nhân viên' });
    }
}

const avatarUrl = ref(null);

const onAvatarFileChange = (event) => {
    const file = event.target?.files?.[0];
    if (file) {
        selectedFile.value = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            avatarUrl.value = e.target?.result;
        };
        reader.readAsDataURL(file);
    }
};

const getImageUrl = (url) => {
    return import.meta.env.VITE_API_URL + url;
};
</script>

<template>
    <div>
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <Button label="Thêm" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew" />
                    <Button label="Xóa" icon="pi pi-trash" severity="secondary" @click="confirmDeleteSelected" :disabled="!selectedUsers || !selectedUsers.length" />
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                v-model:selection="selectedUsers"
                :value="users"
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
                currentPageReportTemplate="Hiển thị {first} đến {last} của {totalRecords} nhân viên"
            >
                <template #empty>
                    <span>Không có nhân viên nào</span>
                </template>
                <template #paginatorstart>
                    <Button type="button" @click="fetchUsers" icon="pi pi-refresh" text />
                </template>
                <template #header>
                    <div class="flex flex-wrap gap-2 items-center justify-between">
                        <h4 class="m-0">Quản lý nhân viên</h4>
                        <IconField>
                            <InputIcon><i class="pi pi-search" /></InputIcon>
                            <InputText v-model="filters['global'].value" placeholder="Tìm kiếm..." />
                        </IconField>
                    </div>
                </template>

                <Column selectionMode="multiple" style="width: 3rem" :exportable="false" />
                <Column field="fullName" header="Họ tên" sortable style="min-width: 10rem">
                    <template #body="{ data }">
                        <div class="flex items-center gap-2">
                            <Avatar :image="`${data.avatarUrl ? getImageUrl(data.avatarUrl) : '/images/avatar-default.svg'}`" class="mr-2" size="large" shape="circle" />
                            <span>{{ data.fullName }}</span>
                        </div>
                    </template>
                </Column>
                <Column field="department.name" header="Phòng ban" style="min-width: 10rem" />
                <Column field="username" header="Tài khoản" sortable style="min-width: 10rem" />
                <Column field="role" header="Loại người dùng">
                    <template #body="slotProps">
                        {{ getRoleLabel(slotProps.data.role) }}
                    </template>
                </Column>

                <Column field="seniority" header="Thâm niên">
                    <template #body="slotProps">
                        {{ getSeniorityLabel(slotProps.data.seniority) }}
                    </template>
                </Column>
                <Column field="note" header="Ghi chú" style="min-width: 10rem" />
                <Column :exportable="false" style="min-width: 10rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-pencil" outlined rounded class="mr-2" @click="editUser(slotProps.data)" />
                        <Button icon="pi pi-trash" outlined rounded severity="danger" @click="confirmDeleteUser(slotProps.data)" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- Dialog thêm/sửa -->
        <Dialog v-model:visible="userDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Thông tin nhân viên" :modal="true">
            <div class="flex flex-col gap-4">
                <!-- Avatar UI -->
                <div class="bg-white rounded-xl px-6 py-4 relative border border-gray-300">
                    <div class="flex justify-between items-start">
                        <span class="font-bold uppercase text-sm text-gray-700">Ảnh đại diện</span>
                        <label for="avatarInput" class="flex items-center gap-1 cursor-pointer text-primary hover:underline text-sm"> <i class="pi pi-pencil text-xs"></i>Sửa </label>
                        <input id="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarFileChange" />
                    </div>
                    <div class="flex justify-center mt-4">
                        <img :src="avatarUrl || '/images/avatar-default.svg'" alt="avatar" class="w-32 h-32 object-cover rounded-full border-2 border-gray-300 shadow-sm" />
                    </div>
                </div>

                <div>
                    <label class="font-bold block mb-1">Phòng ban</label>
                    <Select v-model="user.departmentId" :options="departments" optionLabel="name" optionValue="id" class="w-full" />
                </div>

                <div>
                    <label class="font-bold block mb-1">Họ và tên<span class="text-red-500">*</span></label>
                    <InputText v-model="user.fullName" class="w-full" :invalid="submitted && !user.fullName" />
                    <small v-if="submitted && !user.fullName" class="text-red-500">Vui lòng nhập họ tên.</small>
                </div>

                <div>
                    <label class="font-bold block mb-1">Tài khoản<span class="text-red-500">*</span></label>
                    <InputText v-model="user.username" class="w-full" :invalid="submitted && !user.username" />
                    <small v-if="submitted && !user.username" class="text-red-500">Vui lòng nhập tài khoản.</small>
                </div>

                <div>
                    <label class="font-bold block mb-1">
                        Mật khẩu
                        <span v-if="!user.id" class="text-red-500">*</span>
                        <span v-else class="text-gray-500 text-sm">(để trống nếu không đổi)</span>
                    </label>
                    <Password v-model="user.password" toggleMask class="w-full" fluid :feedback="false" :invalid="submitted && !user.id && !user.password" />
                    <small v-if="submitted && !user.id && !user.password" class="text-red-500"> Vui lòng nhập mật khẩu. </small>
                    <small v-if="user.id" class="text-gray-500"> Để trống nếu không muốn đổi mật khẩu </small>
                </div>

                <div>
                    <label class="font-bold block mb-1">Loại người dùng<span class="text-red-500">*</span></label>
                    <Dropdown v-model="user.role" :options="roleOptions" optionLabel="label" optionValue="value" class="w-full" :invalid="submitted && !user.role" />
                    <small v-if="submitted && !user.role" class="text-red-500">Vui lòng chọn chức vụ.</small>
                </div>

                <div>
                    <label class="font-bold block mb-1">Thâm niên</label>
                    <Dropdown v-model="user.seniority" :options="seniorityOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>

                <div>
                    <label class="font-bold block mb-1">Email</label>
                    <InputText v-model="user.email" type="email" class="w-full" />
                    <small v-if="submitted && user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)" class="text-red-500">Email không hợp lệ.</small>
                </div>

                <div>
                    <label class="font-bold block mb-1">Ghi chú</label>
                    <Textarea v-model="user.note" rows="2" class="w-full" />
                </div>
            </div>

            <template #footer>
                <Button label="Huỷ" icon="pi pi-times" text @click="hideDialog" />
                <Button label="Lưu" icon="pi pi-check" @click="saveUser" />
            </template>
        </Dialog>

        <!-- Confirm xoá 1 nhân viên -->
        <Dialog v-model:visible="deleteUserDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Xác nhận" :modal="true">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle text-3xl" />
                <span v-if="user">
                    Bạn có chắc chắn muốn xoá <b>{{ user.fullName }}</b
                    >?
                </span>
            </div>
            <template #footer>
                <Button label="Không" icon="pi pi-times" text @click="deleteUserDialog = false" />
                <Button label="Xoá" icon="pi pi-check" @click="deleteUser" />
            </template>
        </Dialog>

        <!-- Confirm xoá nhiều -->
        <Dialog v-model:visible="deleteUsersDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Xác nhận" :modal="true">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle text-3xl" />
                <span>Bạn có chắc chắn muốn xoá các nhân viên đã chọn?</span>
            </div>
            <template #footer>
                <Button label="Không" icon="pi pi-times" text @click="deleteUsersDialog = false" />
                <Button label="Xoá" icon="pi pi-check" text @click="deleteSelectedUsers" />
            </template>
        </Dialog>
    </div>
</template>