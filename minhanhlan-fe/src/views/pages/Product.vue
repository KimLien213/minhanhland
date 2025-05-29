<script setup>
import FullscreenImageGallery from '@/components/galeria/FullscreenImageGallery.vue';
import { authService } from '@/service/AuthService';
import { productService } from '@/service/ProductService';
import { socketService } from '@/service/SocketService';
import { sortPreferencesService } from '@/service/SortPreferencesService';
import { FilterMatchMode } from '@primevue/core/api';
import { format } from 'date-fns';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const socketCleanups = ref([]);
const productDialog = ref(false);
const deleteProductDialog = ref(false);
const deleteProductsDialog = ref(false);
const product = ref({});
const route = useRoute();
const submitted = ref(false);
const directions = ['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Bắc', 'Đông Nam', 'Tây Bắc', 'Tây Nam'];
const fileRef = ref();
const isMobile = ref(false);

const handleResize = () => {
    isMobile.value = window.innerWidth <= 768;
};

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
});

const toast = useToast();
const dt = ref();
const virtualProducts = ref([]); // Virtual products cho DataTable
const selectedProducts = ref([]);
const totalRecords = ref(0);
const lazyLoading = ref(false);
const apartmentType = ref('');
const subdivision = ref('');
const loadedPages = ref(new Set()); // Track các page đã load
const isAdmin = ref(false);

// Parameters for API calls
const lazyParams = ref({
    page: 1,
    limit: 50,
    sortBy: null,
    sortOrder: 'ASC',
    search: '',
    buildingCode: [],
    apartmentCode: [],
    subdivision: [],
    apartmentEncode: [],
    area: [],
    sellingPrice: [],
    tax: [],
    furnitureNote: [],
    mortgageInfo: [],
    description: [],
    balconyDirection: [],
    apartmentContactInfo: [],
    contactInfo: [],
    source: [],
    status: [],
    apartmentType: null,
    subdivision: null
});

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    buildingCode: { value: null, matchMode: FilterMatchMode.IN },
    apartmentCode: { value: null, matchMode: FilterMatchMode.IN },
    apartmentEncode: { value: null, matchMode: FilterMatchMode.IN },
    area: { value: null, matchMode: FilterMatchMode.IN },
    sellingPrice: { value: null, matchMode: FilterMatchMode.IN },
    tax: { value: null, matchMode: FilterMatchMode.IN },
    furnitureNote: { value: null, matchMode: FilterMatchMode.IN },
    mortgageInfo: { value: null, matchMode: FilterMatchMode.IN },
    description: { value: null, matchMode: FilterMatchMode.IN },
    balconyDirection: { value: null, matchMode: FilterMatchMode.IN },
    apartmentContactInfo: { value: null, matchMode: FilterMatchMode.IN },
    contactInfo: { value: null, matchMode: FilterMatchMode.IN },
    source: { value: null, matchMode: FilterMatchMode.IN },
    status: { value: null, matchMode: FilterMatchMode.IN }
});

const columns = ref([]);

watch(
    () => filters.value.global.value,
    (val) => {
        // Chỉ search khi đã khởi tạo
        if (isInitialized.value) {
            lazyParams.value.search = val;
            resetData();
        }
    }
);

// Flag để tránh call API nhiều lần
const isInitialized = ref(false);

watch(
    () => route.params,
    async (newParams, oldParams) => {
        // Chỉ reset khi thực sự thay đổi route params
        if (newParams.type !== oldParams?.type || newParams.subdivision !== oldParams?.subdivision) {
            apartmentType.value = newParams.type;
            subdivision.value = newParams.subdivision;
            lazyParams.value.apartmentType = newParams.type;
            lazyParams.value.subdivision = newParams.subdivision;

            // Reset filters khi chuyển menu
            resetFilters();

            if (isInitialized.value) {
                await fetchFilterOptions();
                resetData();
            }
        }
        updateSocketRoom();
    }
);
// Socket functions
const initializeSocket = () => {
    try {
        socketService.connect();

        // Join the product room
        if (subdivision.value && apartmentType.value) {
            socketService.joinProductRoom(subdivision.value, apartmentType.value);
        }

        // Setup event listeners
        setupSocketListeners();
    } catch (error) {
        console.error('Failed to initialize socket:', error);
    }
};

const updateSocketRoom = () => {
    if (!socketService.isConnected()) return;

    // Leave old room and join new room
    socketService.leaveProductRoom(subdivision.value, apartmentType.value);
    if (subdivision.value && apartmentType.value) {
        socketService.joinProductRoom(subdivision.value, apartmentType.value);
    }
};

const setupSocketListeners = () => {
    // Clean up existing listeners
    cleanupSocket();

    // Product created
    const cleanupCreated = socketService.onProductCreated((event) => {
        console.log('Product created:', event);
        handleProductCreated(event.data);
        toast.add({
            severity: 'info',
            summary: 'Sản phẩm mới',
            detail: `Căn hộ ${event.data.apartmentCode} vừa được thêm`,
            life: 3000
        });
    });

    // Product updated
    const cleanupUpdated = socketService.onProductUpdated((event) => {
        console.log('Product updated:', event);
        handleProductUpdated(event.data);
        toast.add({
            severity: 'info',
            summary: 'Cập nhật sản phẩm',
            detail: `Căn hộ ${event.data.apartmentCode} vừa được cập nhật`,
            life: 3000
        });
    });

    // Product deleted
    const cleanupDeleted = socketService.onProductDeleted((event) => {
        console.log('Product deleted:', event);
        handleProductDeleted(event.data.id);
        toast.add({
            severity: 'warn',
            summary: 'Xóa sản phẩm',
            detail: `Một căn hộ vừa được xóa`,
            life: 3000
        });
    });

    // Store cleanup functions
    socketCleanups.value = [cleanupCreated, cleanupUpdated, cleanupDeleted];
};

const cleanupSocket = () => {
    // Clean up listeners
    socketCleanups.value.forEach((cleanup) => cleanup());
    socketCleanups.value = [];

    // Leave room and disconnect
    if (socketService.isConnected()) {
        socketService.leaveProductRoom(subdivision.value, apartmentType.value);
        socketService.disconnect();
    }
};

// Handle real-time updates
const handleProductCreated = (newProduct) => {
    // Add to virtual products array
    virtualProducts.value = [newProduct, ...virtualProducts.value];
    totalRecords.value += 1;

    // Clear loaded pages cache to force reload
    loadedPages.value.clear();

    // Update filter options if needed
    fetchFilterOptions();
};

const handleProductUpdated = (updatedProduct) => {
    // Find and update in virtual products array
    const index = virtualProducts.value.findIndex((p) => p?.id === updatedProduct.id);
    if (index !== -1) {
        virtualProducts.value[index] = updatedProduct;
        // Trigger reactivity
        virtualProducts.value = [...virtualProducts.value];
    }

    // Update filter options if needed
    fetchFilterOptions();
};

const handleProductDeleted = (productId) => {
    // Remove from virtual products array
    const index = virtualProducts.value.findIndex((p) => p?.id === productId);
    if (index !== -1) {
        virtualProducts.value.splice(index, 1);
        totalRecords.value -= 1;

        // Clear loaded pages cache
        loadedPages.value.clear();

        // Update filter options
        fetchFilterOptions();
    }
};
function onSort(event) {
    const newSortBy = event.sortField;
    const newSortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';

    // Update current sort
    currentSort.value = {
        sortBy: newSortBy,
        sortOrder: newSortOrder
    };

    // Update lazy params
    lazyParams.value.sortBy = newSortBy;
    lazyParams.value.sortOrder = newSortOrder;

    // Save preference (will be saved automatically by backend)
    resetData();
}

// Reset filters về mặc định
function resetFilters() {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        buildingCode: { value: null, matchMode: FilterMatchMode.IN },
        apartmentCode: { value: null, matchMode: FilterMatchMode.IN },
        apartmentEncode: { value: null, matchMode: FilterMatchMode.IN },
        area: { value: null, matchMode: FilterMatchMode.IN },
        sellingPrice: { value: null, matchMode: FilterMatchMode.IN },
        tax: { value: null, matchMode: FilterMatchMode.IN },
        furnitureNote: { value: null, matchMode: FilterMatchMode.IN },
        mortgageInfo: { value: null, matchMode: FilterMatchMode.IN },
        description: { value: null, matchMode: FilterMatchMode.IN },
        balconyDirection: { value: null, matchMode: FilterMatchMode.IN },
        apartmentContactInfo: { value: null, matchMode: FilterMatchMode.IN },
        contactInfo: { value: null, matchMode: FilterMatchMode.IN },
        source: { value: null, matchMode: FilterMatchMode.IN },
        status: { value: null, matchMode: FilterMatchMode.IN }
    };

    // Reset lazy params filters
    lazyParams.value.search = '';
    lazyParams.value.buildingCode = [];
    lazyParams.value.apartmentCode = [];
    lazyParams.value.apartmentEncode = [];
    lazyParams.value.area = [];
    lazyParams.value.sellingPrice = [];
    lazyParams.value.tax = [];
    lazyParams.value.furnitureNote = [];
    lazyParams.value.mortgageInfo = [];
    lazyParams.value.description = [];
    lazyParams.value.balconyDirection = [];
    lazyParams.value.apartmentContactInfo = [];
    lazyParams.value.contactInfo = [];
    lazyParams.value.source = [];
    lazyParams.value.status = [];
}

// Reset data và load lại từ đầu
function resetData() {
    console.log('Resetting data...'); // Debug log
    virtualProducts.value = [];
    totalRecords.value = 0;
    loadedPages.value.clear();
    selectedProducts.value = [];
    fetchInitialData();
}

// Fetch initial data để biết total records - chỉ load page đầu
async function fetchInitialData() {
    if (!lazyParams.value.apartmentType || !lazyParams.value.subdivision) {
        console.warn('Missing apartmentType or subdivision parameters');
        return;
    }

    try {
        lazyLoading.value = true;
        const params = { ...lazyParams.value, page: 1, limit: 50 };
        const response = await productService.getAll(params);
        const data = response.data;

        totalRecords.value = data.total || 0;

        if (data.currentSort) {
            currentSort.value = data.currentSort;
        }

        if (totalRecords.value === 0) {
            virtualProducts.value = [];
            return;
        }

        // Initialize virtual array với total length - fill với placeholder object
        virtualProducts.value = Array.from({ length: totalRecords.value }, (_, index) => ({
            id: `placeholder-${index}`,
            isPlaceholder: true
        }));

        // CHỈ load page đầu tiên (page 1)
        if (data.data && data.data.length > 0) {
            data.data.forEach((item, index) => {
                if (index < virtualProducts.value.length) {
                    virtualProducts.value[index] = { ...item, isPlaceholder: false };
                }
            });
            loadedPages.value.add(1);
            console.log('Loaded ONLY first page'); // Debug log
        }

        // Force reactivity update
        virtualProducts.value = [...virtualProducts.value];
    } catch (err) {
        console.error('Error fetching initial data:', err);
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được sản phẩm' });
        virtualProducts.value = [];
        totalRecords.value = 0;
    } finally {
        lazyLoading.value = false;
    }
}

// Virtual scroll lazy loading function - Tối ưu performance
const loadProductsLazy = async (event) => {
    if (lazyLoading.value) return;

    const { first, last } = event;
    const pageSize = 50;
    const startPage = Math.floor(first / pageSize) + 1;
    const endPage = Math.ceil(last / pageSize);

    // Load các page chưa được load
    const pagesToLoad = [];
    for (let page = startPage; page <= endPage; page++) {
        if (!loadedPages.value.has(page)) {
            pagesToLoad.push(page);
        }
    }

    // Nếu không có page nào cần load, thoát sớm
    if (pagesToLoad.length === 0) {
        return;
    }

    lazyLoading.value = true;

    try {
        // Load tất cả pages song song thay vì tuần tự
        const promises = pagesToLoad.map(async (page) => {
            const params = { ...lazyParams.value, page, limit: pageSize };
            const response = await productService.getAll(params);
            return { page, data: response.data };
        });

        const results = await Promise.all(promises);

        // Batch update virtual array một lần duy nhất
        const _virtualProducts = [...virtualProducts.value];

        results.forEach(({ page, data }) => {
            const startIndex = (page - 1) * pageSize;

            data.data.forEach((item, index) => {
                const targetIndex = startIndex + index;
                if (targetIndex < _virtualProducts.length) {
                    _virtualProducts[targetIndex] = { ...item, isPlaceholder: false };
                }
            });

            loadedPages.value.add(page);
        });

        // Single update để trigger reactivity
        virtualProducts.value = _virtualProducts;
    } catch (err) {
        console.error('❌ Error loading lazy data:', err);
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được sản phẩm' });
    } finally {
        lazyLoading.value = false;
    }
};

const filterOptions = ref({
    buildingCode: [],
    apartmentCode: [],
    apartmentEncode: [],
    area: [],
    sellingPrice: [],
    tax: [],
    furnitureNote: [],
    mortgageInfo: [],
    description: [],
    balconyDirection: [],
    apartmentContactInfo: [],
    contactInfo: [],
    source: [],
    status: []
});

onMounted(async () => {
    handleResize();
    initializeSocket();
    window.addEventListener('resize', handleResize);
    isAdmin.value = authService.isAdmin();

    // Chỉ setup params một lần
    if (route.params.type && route.params.subdivision) {
        apartmentType.value = route.params.type;
        subdivision.value = route.params.subdivision;
        lazyParams.value.apartmentType = apartmentType.value;
        lazyParams.value.subdivision = subdivision.value;

        await loadSortPreferences();
        // Load permissions và filter options trước
        await Promise.all([getMe(), fetchFilterOptions()]);

        // Sau đó mới load data (chỉ page đầu)
        await fetchInitialData();

        isInitialized.value = true;
    } else {
        console.warn('Missing route parameters: type or subdivision');
    }
});
const loadSortPreferences = async () => {
    try {
        const sortPreference = await sortPreferencesService.getSortPreference('products');
        if (sortPreference && sortPreference.sortBy) {
            currentSort.value = {
                sortBy: sortPreference.sortBy,
                sortOrder: sortPreference.sortOrder || 'DESC'
            };
            lazyParams.value.sortBy = sortPreference.sortBy;
            lazyParams.value.sortOrder = sortPreference.sortOrder || 'DESC';
        }
    } catch (err) {
        console.log('No saved sort preferences found');
    }
};
async function fetchFilterOptions() {
    if (!lazyParams.value.apartmentType || !lazyParams.value.subdivision) {
        return;
    }

    try {
        const res = await productService.getFilterOptions(lazyParams.value);
        filterOptions.value = res.data;
    } catch (err) {
        console.error('Error fetching filter options:', err);
        // Không show toast error cho filter options để tránh spam
    }
}

const form = ref({
    buildingCode: '',
    apartmentCode: '',
    apartmentType: apartmentType.value,
    subdivision: subdivision.value,
    apartmentEncode: '',
    area: null,
    sellingPrice: '',
    tax: null,
    furnitureNote: '',
    mortgageInfo: '',
    description: '',
    balconyDirection: null,
    apartmentContactInfo: '',
    contactInfo: '',
    source: '',
    status: 'DANG_BAN'
});

const errors = reactive({});

const statusOptions = [
    { label: 'Đang bán', value: 'DANG_BAN' },
    { label: 'Tạm dừng', value: 'TAM_DUNG' },
    { label: 'Đã bán', value: 'DA_BAN' }
];

const updateEncode = () => {
    const code = form.value.apartmentCode || '';
    if (code.length >= 3) {
        const index = code.length - 3;
        form.value.apartmentEncode = code.substring(0, index) + 'x' + code.substring(index + 1);
    } else {
        form.value.apartmentEncode = '';
    }
};

const formatPhone = (field) => {
    const digits = form.value[field].replace(/\D/g, '').substring(0, 11);
    const formatted = digits.replace(/(\d{3})(\d{3})(\d{0,4})/, (match, p1, p2, p3) => {
        return p3 ? `${p1} ${p2} ${p3}` : `${p1} ${p2}`;
    });
    form.value[field] = formatted;
};

const validateForm = () => {
    errors.buildingCode = !form.value.buildingCode ? 'Vui lòng nhập mã tòa' : '';
    errors.apartmentCode = !form.value.apartmentCode ? 'Vui lòng nhập mã căn' : '';
    errors.area = !form.value.area ? 'Vui lòng nhập diện tích' : '';
    errors.sellingPrice = !form.value.sellingPrice ? 'Vui lòng nhập giá bán' : '';
    errors.status = !form.value.status ? 'Vui lòng chọn tình trạng' : '';
    return Object.values(errors).every((e) => !e);
};

const files = ref([]);

const onFilter = () => {
    // Chỉ filter khi đã khởi tạo
    if (!isInitialized.value) return;

    lazyParams.value.buildingCode = filters.value['buildingCode'].value;
    lazyParams.value.apartmentCode = filters.value['apartmentCode'].value;
    lazyParams.value.apartmentEncode = filters.value['apartmentEncode'].value;
    lazyParams.value.area = filters.value['area'].value;
    lazyParams.value.sellingPrice = filters.value['sellingPrice'].value;
    lazyParams.value.tax = filters.value['tax'].value;
    lazyParams.value.furnitureNote = filters.value['furnitureNote'].value;
    lazyParams.value.mortgageInfo = filters.value['mortgageInfo'].value;
    lazyParams.value.description = filters.value['description'].value;
    lazyParams.value.balconyDirection = filters.value['balconyDirection'].value;
    lazyParams.value.apartmentContactInfo = filters.value['apartmentContactInfo'].value;
    lazyParams.value.contactInfo = filters.value['contactInfo'].value;
    lazyParams.value.source = filters.value['source'].value;
    lazyParams.value.status = filters.value['status'].value;

    fetchFilterOptions();
    resetData();
};

async function submit() {
    if (!validateForm()) return;
    const data = new FormData();
    data.append('area', Number(form.value.area || 0));
    data.append('tax', Number(form.value.tax || 0));
    data.append('apartmentType', apartmentType.value);
    data.append('subdivision', subdivision.value);
    for (const [key, value] of Object.entries(form.value)) {
        if (['area', 'tax', 'apartmentType', 'subdivision'].includes(key)) continue;
        data.append(key, value || '');
    }

    files.value.forEach((f) => data.append('images', f));
    form.value.imageList?.forEach((f) => data.append('imageIds', f.id));
    try {
        if (!form.value.id) {
            await productService.create(data);
        } else {
            await productService.update(form.value.id, data);
        }
        toast.add({
            severity: 'success',
            summary: `${form.value.id ? 'Cập nhật' : 'Thêm'} căn hộ thành công`,
            detail: form.value.apartmentCode,
            life: 1000
        });
        hideDialog();
        resetData();
    } catch (ex) {
        toast.add({
            severity: 'error',
            summary: `${form.value.id ? 'Cập nhật' : 'Thêm'} căn hộ không thành công`,
            detail: form.value.apartmentCode,
            life: 1000
        });
    }
}

function openNew() {
    form.value = {
        buildingCode: '',
        apartmentCode: '',
        apartmentType: apartmentType.value,
        subdivision: subdivision.value,
        apartmentEncode: '',
        area: null,
        sellingPrice: '',
        tax: null,
        furnitureNote: '',
        mortgageInfo: '',
        description: '',
        balconyDirection: null,
        apartmentContactInfo: '',
        contactInfo: '',
        source: '',
        status: 'DANG_BAN'
    };
    submitted.value = false;
    productDialog.value = true;
}

function hideDialog() {
    productDialog.value = false;
    submitted.value = false;
}

function editProduct(prod) {
    form.value = { ...prod };
    files.value = [];
    productDialog.value = true;
}

function confirmDeleteProduct(prod) {
    product.value = prod;
    deleteProductDialog.value = true;
}

async function deleteProduct() {
    try {
        await productService.remove(product.value.id);
        toast.add({ severity: 'success', summary: 'Đã xoá', detail: product.value.apartmentCode, life: 3000 });
        deleteProductDialog.value = false;
        resetData();
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: `Không thể xoá ${product.value.apartmentCode}`, life: 3000 });
    }
    product.value = {};
}

function confirmDeleteSelected() {
    deleteProductsDialog.value = true;
}

async function deleteSelectedProducts() {
    try {
        await Promise.all(selectedProducts.value.map((u) => productService.remove(u.id)));
        toast.add({ severity: 'success', summary: 'Đã xoá', detail: 'Đã xoá các căn hộ được chọn', life: 3000 });
        resetData();
        deleteProductsDialog.value = false;
        selectedProducts.value = null;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không thể xoá các căn hộ được chọn', life: 3000 });
    }
}

function getDirectionColor(direction) {
    switch (direction) {
        case 'Đông':
            return '#F8BBD0';
        case 'Tây':
            return '#FFE0B2';
        case 'Nam':
            return '#FFF9C4';
        case 'Bắc':
            return '#C8E6C9';
        case 'Đông Bắc':
            return '#B2EBF2';
        case 'Đông Nam':
            return '#BBDEFB';
        case 'Tây Bắc':
            return '#D1C4E9';
        case 'Tây Nam':
            return '#F3E5F5';
        default:
            return 'secondary';
    }
}

function getStatusColor(status) {
    switch (status) {
        case 'DANG_BAN':
            return {
                color: 'info',
                text: 'Đang bán'
            };
        case 'DA_BAN':
            return {
                color: 'danger',
                text: 'Đã bán'
            };
        default:
            return {
                color: 'warn',
                text: 'Tạm dừng'
            };
    }
}

// Tối ưu format phone number với memoization
const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10) {
        return cleaned.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    } else if (cleaned.length === 11 && cleaned.startsWith('84')) {
        return '+' + cleaned.replace(/(\d{2})(\d{3})(\d{4})(\d{2})/, '$1 $2 $3 $4');
    }
    return phone;
};

// permission
const userPermissions = ref([]);
const getMe = async () => {
    try {
        const res = await authService.getMe();
        userPermissions.value = res.data?.permissions?.fieldNames || [];
        columns.value = columnDefaults.value.filter((col) => !userPermissions.value.includes(col.key));
    } catch (err) {
        console.error('Error getting user permissions:', err);
    }
};

const columnDefaults = ref([
    { key: 'buildingCode', label: 'Mã tòa', frozen: true, mobileFrozen: false, width: 7, mobileWidth: 6, filterable: true, maxWidth: 8 },
    { key: 'apartmentCode', label: 'Mã căn', frozen: true, mobileFrozen: true, width: 5, mobileWidth: 4, maxWidth: 8 },
    { key: 'apartmentEncode', label: 'Mã căn x', frozen: true, mobileFrozen: true, width: 5, mobileWidth: 4 },
    { key: 'area', label: 'S', type: 's', width: 5, mobileWidth: 4, filterable: true, maxWidth: 6.5 },
    { key: 'sellingPrice', label: 'Giá bán', width: 5, maxWidth: 6.5 },
    { key: 'tax', label: 'Thuế phí', type: 'money', width: 6, maxWidth: 6 },
    { key: 'furnitureNote', label: 'Nội thất', width: 7.5, filterable: true, maxWidth: 8 },
    { key: 'mortgageInfo', label: 'TT Sổ đỏ + Vay', width: 11, filterable: true, maxWidth: 15 },
    { key: 'description', label: 'Lưu ý', width: 10, maxWidth: 12 },
    { key: 'balconyDirection', label: 'Ban công', type: 'tag', color: (value) => getDirectionColor(value), width: 8, filterable: true },
    { key: 'updatedAt', label: 'Ngày cập nhật', type: 'date', width: 8 },
    { key: 'imageList', label: 'Hình ảnh', type: 'images', width: 8, sortable: false },
    {
        key: 'status',
        label: 'Trạng thái',
        type: 'tag',
        width: 9,
        color: (value) => getStatusColor(value).color,
        text: (value) => getStatusColor(value).text,
        filterable: true
    },
    { key: 'apartmentContactInfo', label: 'SĐT Liên hệ', type: 'phone', width: 10, filterable: true },
    { key: 'contactInfo', label: 'Liên hệ', type: 'phone', width: 8, filterable: true },
    { key: 'source', label: 'Báo nguồn', type: 'phone', width: 9, filterable: true }
]);

const onColumnReorder = (event) => {
    if (event.dragIndex === 0 || event.dropIndex === 0) {
        columns.value = [...columnDefaults.value.filter((col) => !userPermissions.value.includes(col.key))];
    }
};

// refs cho từng cột
const multiSelectRefs = reactive({});
const multiSelectFullRefs = reactive({});

// Tạo toggle function để mở đúng dropdown
const toggleFilter = (key) => {
    if (!multiSelectRefs[key]) return;

    nextTick(() => {
        multiSelectRefs[key]?.show();
    });
};

const toggleFilterFull = (key) => {
    if (!multiSelectFullRefs[key]) return;

    nextTick(() => {
        multiSelectFullRefs[key]?.show();
    });
};

const setMultiSelectRef = (key, el) => {
    if (el) {
        multiSelectRefs[key] = el;
    }
};
const setMultiSelectFullRef = (key, el) => {
    if (el) {
        multiSelectFullRefs[key] = el;
    }
};

const clearFilter = (key) => {
    filters.value[key].value = null;
    onFilter();
};

const fileUploadRef = ref(null);

// Paste support
const onPaste = (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                file.objectURL = URL.createObjectURL(file);
                fileUploadRef.value?.files?.push(file);
                onSelectedFiles({ files: fileUploadRef.value.files });
            }
        }
    }
};

const mergedImageList = computed(() => {
    const initial = (form.value?.imageList || []).map((file, idx) => ({
        ...file,
        url: import.meta.env.VITE_API_URL + file.url,
        key: `initial-${file.url}`,
        type: 'initial',
        index: idx
    }));

    const pending = files.value?.map((file, idx) => ({
        ...file,
        url: file.objectURL,
        key: `pending-${file.name + file.size}`,
        type: 'pending',
        index: idx
    }));

    return [...initial, ...pending];
});

const handleRemoveImage = (file) => {
    if (file.type === 'initial') {
        form.value.imageList = form.value.imageList.filter((item) => item.id !== file.id);
    } else if (file.type === 'pending') {
        files.value = files.value.filter((item) => item.objectURL !== file.url);
    }
};

const onSelectedFiles = (event) => {
    files.value = event.files;
};

const showImageGalery = ref(false);
const imageGalery = ref([]);

// Update showImages function
const showImages = (images) => {
    if (!images || images.length === 0) return;

    imageGalery.value = images.map((t, index) => ({
        src: import.meta.env.VITE_API_URL + t.url,
        alt: `Hình ảnh ${index + 1}`
    }));

    showImageGalery.value = true;
};
const fullScreen = ref(false);
const getRowIndex = (rowIndex) => {
    const currentPage = lazyParams.value.page || 1;
    const pageSize = lazyParams.value.limit || 20;
    return (currentPage - 1) * pageSize + rowIndex + 1;
};
const currentSort = ref({
    sortBy: null,
    sortOrder: 'DESC'
});
const getColumnStyle = computed(() => {
    return (item) => ({
        minWidth: `${(isMobile.value ? item.mobileWidth || item.width : item.width) - (isAdmin.value ? 0 : item.filterable ? 1 : 2)}rem`,
        height: '60px',
        maxWidth: item.maxWidth ? `${item.maxWidth}rem` : undefined
    });
});
</script>

<template>
    <div>
        <ConnectionStatus />
        <div class="card">
            <Toolbar class="mb-6">
                <template #start>
                    <Button label="Thêm" icon="pi pi-plus" severity="secondary" class="mr-2" @click="openNew" />
                    <Button label="Xóa" icon="pi pi-trash" severity="secondary" @click="confirmDeleteSelected" :disabled="!selectedProducts || !selectedProducts.length" />
                </template>
            </Toolbar>

            <DataTable
                ref="dt"
                :value="virtualProducts"
                dataKey="id"
                size="small"
                v-model:selection="selectedProducts"
                :filters="filters"
                resizableColumns
                columnResizeMode="expand"
                stripedRows
                reorderableColumns
                scrollable
                scrollHeight="600px"
                scrollDirection="horizontal"
                filterDisplay="menu"
                tableStyle="min-width: 50rem"
                :virtualScrollerOptions="{
                    lazy: true,
                    onLazyLoad: loadProductsLazy,
                    itemSize: 60,
                    delay: 0,
                    showLoader: true,
                    loading: lazyLoading,
                    numToleratedItems: 5,
                    step: 5
                }"
                @columnReorder="onColumnReorder"
                @sort="onSort"
                @filter="onFilter"
                :sortField="currentSort.sortBy"
                :sortOrder="currentSort.sortOrder === 'ASC' ? 1 : -1"
            >
                <template #empty>
                    <span>Không có căn hộ nào.</span>
                </template>
                <template #header>
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
                        <div class="flex items-start gap-2">
                            <span class="text-sm font-bold">Tống số: {{ totalRecords }} căn hộ</span>
                        </div>
                        <div class="flex items-end gap-2">
                            <IconField class="w-full">
                                <InputIcon>
                                    <i class="pi pi-search" />
                                </InputIcon>
                                <InputText v-model="filters['global'].value" class="w-full" placeholder="Tìm kiếm..." />
                            </IconField>
                            <Button type="button" @click="resetData" icon="pi pi-refresh" text />
                            <Button type="button" icon="pi pi-window-maximize" @click="fullScreen = true" text />
                        </div>
                    </div>
                </template>
                <Column selectionMode="multiple" :frozen="!isMobile" style="width: 2rem; height: 60px" :exportable="false">
                    <template #loading>
                        <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                            <Skeleton width="100%" height="1rem" />
                        </div>
                    </template>
                </Column>
                <!-- Cột số thứ tự -->
                <Column header="STT" :frozen="!isMobile" :sortable="false">
                    <template #body="{ index }">
                        <div class="flex items-center justify-center">
                            <span class="font-bold">{{ getRowIndex(index) }}</span>
                        </div>
                    </template>
                    <template #loading>
                        <div class="flex items-center justify-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                            <Skeleton width="2rem" height="1rem" />
                        </div>
                    </template>
                </Column>

                <Column
                    v-for="item in columns"
                    :sortable="item.sortable !== false && isAdmin"
                    :key="item.key"
                    :sortField="item.key"
                    :showFilterMatchModes="false"
                    :frozen="item.frozen && !isMobile"
                    :style="getColumnStyle(item)"
                    :class="item.frozen ? 'font-bold' : ''"
                >
                    <template #body="{ data }">
                        <!-- Hiển thị skeleton cho placeholder -->
                        <div v-if="!data || data.isPlaceholder" class="flex items-center" style="height: 17px">
                            <Skeleton :width="item.type === 'tag' ? '80%' : item.type === 'phone' ? '70%' : '60%'" height="1rem" />
                        </div>
                        <!-- Render data với v-else-if để tối ưu -->
                        <template v-else>
                            <div v-if="item.type === 'tag'" class="flex items-center gap-2">
                                <Tag :value="!item.text ? data[item.key] : item.text(data[item.key])" :severity="item.color(data[item.key])" :style="{ backgroundColor: item.color(data[item.key]), color: '#000' }" />
                            </div>
                            <div v-else-if="item.type === 's'" class="flex items-center gap-2 justify-end">
                                <span>{{ Number(data[item.key] || 0) }}m²</span>
                            </div>
                            <div v-else-if="item.type === 'money'" class="flex items-center gap-2 justify-end">{{ Number(data[item.key] || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) }}tr</div>
                            <div v-else-if="item.type === 'images'" class="flex items-center justify-center gap-2">
                                <Button v-if="data[item.key]?.length > 0" @click="showImages(data[item.key])" icon="pi pi-images" outlined rounded severity="info" />
                                <span v-else>Không có ảnh</span>
                            </div>
                            <div v-else-if="item.type === 'phone'" class="flex items-center gap-2">
                                <a v-if="data[item.key]" :href="`tel:${data[item.key]}`" class="inline-flex items-center gap-1 text-gray-700 hover:text-blue-500">
                                    <i class="pi pi-phone text-lg"></i>
                                    <span>{{ formatPhoneNumber(data[item.key]) }}</span>
                                </a>
                            </div>
                            <div v-else-if="item.type === 'date'" class="flex items-center gap-2">
                                <span>{{ data[item.key] ? format(new Date(data[item.key]), 'yyyy-MM-dd') : null }}</span>
                            </div>
                            <div v-else class="flex items-center gap-2">
                                <span>{{ data[item.key] || '' }}</span>
                            </div>
                        </template>
                    </template>

                    <template #loading>
                        <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                            <Skeleton :width="item.type === 'tag' ? '80%' : item.type === 'phone' ? '70%' : '60%'" height="1rem" />
                        </div>
                    </template>

                    <template #header>
                        <div class="relative w-full h-full">
                            <span class="inline-block font-bold">{{ item.label }}</span>

                            <i
                                class="pi pi-filter absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer"
                                v-if="item.filterable"
                                :class="filters[item.key]?.value?.length ? 'text-blue-500' : 'text-gray-400 hover:text-gray-700'"
                                @click.stop="toggleFilter(item.key)"
                            ></i>

                            <MultiSelect
                                v-if="item.filterable"
                                :ref="(el) => setMultiSelectRef(item.key, el)"
                                v-model="filters[item.key].value"
                                :options="filterOptions[item.key]"
                                @change="onFilter"
                                filter
                                display="chip"
                                panelClass="z-50"
                                panelStyle="width: 150px"
                                placeholder="Lọc..."
                                class="absolute top-full right-0 w-0 h-0 p-0 overflow-hidden border-none shadow-none focus:ring-0"
                            >
                                <template #option="slotProps">
                                    <div v-if="item.type === 'tag'" class="flex items-center gap-2">
                                        <Tag :value="!item.text ? slotProps.option : item.text(slotProps.option)" :severity="item.color(slotProps.option)" :style="{ backgroundColor: item.color(slotProps.option), color: '#000' }" />
                                    </div>
                                    <div v-else-if="item.type === 's'" class="flex items-center gap-2 justify-end">
                                        <span>{{ Number(slotProps.option) }}m²</span>
                                    </div>
                                    <div v-else-if="item.type === 'money'" class="flex items-center gap-2 justify-end">{{ Number(slotProps.option).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) }}tr</div>
                                    <div v-else-if="item.type === 'link'" class="flex items-center gap-2">
                                        <i class="pi pi-paperclip"></i>
                                        <span>Hình ảnh</span>
                                    </div>
                                    <div v-else-if="item.type === 'date'" class="flex items-center gap-2">
                                        <span>{{ slotProps.option ? format(new Date(slotProps.option), 'yyyy-MM-dd') : null }}</span>
                                    </div>
                                    <div v-else-if="item.type === 'phone'" class="flex items-center gap-2">
                                        <span>{{ formatPhoneNumber(slotProps.option) }}</span>
                                    </div>
                                    <div v-else class="flex items-center gap-2">
                                        <span>{{ slotProps.option }}</span>
                                    </div>
                                </template>
                                <template #footer>
                                    <div class="flex justify-end p-2 border-t">
                                        <button type="button" class="text-xs text-blue-500 hover:underline" @click.stop="clearFilter(item.key)">Xóa lọc</button>
                                    </div>
                                </template>
                            </MultiSelect>
                        </div>
                    </template>
                </Column>

                <Column :exportable="false" style="min-width: 12rem; height: 60px">
                    <template #body="{ data }">
                        <!-- Skeleton cho placeholder -->
                        <div v-if="!data || data.isPlaceholder" class="flex items-center gap-2" style="height: 17px">
                            <Skeleton width="2rem" height="2rem" class="rounded-full" />
                            <Skeleton width="2rem" height="2rem" class="rounded-full" />
                        </div>
                        <!-- Action buttons -->
                        <div v-else class="flex items-center gap-2">
                            <Button icon="pi pi-pencil" outlined rounded size="small" @click="editProduct(data)" />
                            <Button icon="pi pi-trash" outlined rounded size="small" severity="danger" @click="confirmDeleteProduct(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Dialog v-model:visible="productDialog" class="w-[90vw] sm:w-[500px] md:w-[600px]" header="Thông tin căn hộ" :modal="true">
            <form @submit.prevent="submit" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-y-2">
                    <label>Mã tòa <span class="text-red-500">*</span></label>
                    <InputText v-model="form.buildingCode" :invalid="!!errors.buildingCode" class="w-full" />
                    <small v-if="errors.buildingCode" class="text-red-500">{{ errors.buildingCode }}</small>
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Mã căn <span class="text-red-500">*</span></label>
                    <InputText v-model="form.apartmentCode" class="w-full" :invalid="!!errors.apartmentCode" @input="updateEncode" />
                    <small v-if="errors.apartmentCode" class="text-red-500">{{ errors.apartmentCode }}</small>
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Mã căn (mã hóa)</label>
                    <InputText v-model="form.apartmentEncode" class="w-full" disabled />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Diện tích <span class="text-red-500">*</span></label>
                    <InputNumber v-model="form.area" suffix=" m²" inputClass="text-right w-full" class="w-full" :invalid="!!errors.area" />
                    <small v-if="errors.area" class="text-red-500">{{ errors.area }}</small>
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Giá bán <span class="text-red-500">*</span></label>
                    <InputText v-model="form.sellingPrice" class="w-full" :invalid="!!errors.sellingPrice" />
                    <small v-if="errors.sellingPrice" class="text-red-500">{{ errors.sellingPrice }}</small>
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Thuế phí</label>
                    <InputNumber v-model="form.tax" :minFractionDigits="0" :maxFractionDigits="2" :useGrouping="true" suffix=" triệu" inputClass="text-right w-full" class="w-full" />
                </div>

                <div class="flex flex-col gap-y-2 md:col-span-2">
                    <label>Nội thất</label>
                    <Textarea v-model="form.furnitureNote" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>TT sổ đỏ + Vay</label>
                    <InputText v-model="form.mortgageInfo" class="w-full" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Hướng ban công</label>
                    <Dropdown v-model="form.balconyDirection" :options="directions" class="w-full" />
                </div>

                <div class="flex flex-col gap-y-2 md:col-span-2">
                    <label>Ghi chú</label>
                    <Textarea v-model="form.description" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>SĐT chủ nhà</label>
                    <InputText v-model="form.apartmentContactInfo" class="w-full text-right" @input="formatPhone('apartmentContactInfo')" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Liên hệ</label>
                    <InputText v-model="form.contactInfo" class="w-full text-right" @input="formatPhone('contactInfo')" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Báo nguồn</label>
                    <InputText v-model="form.source" class="w-full text-right" @input="formatPhone('source')" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Tình trạng <span class="text-red-500">*</span></label>
                    <Dropdown v-model="form.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" :invalid="!!errors.status" />
                    <small v-if="errors.status" class="text-red-500">{{ errors.status }}</small>
                </div>
            </form>

            <div class="card !px-0" @paste="onPaste">
                <FileUpload ref="fileUploadRef" :multiple="true" accept="image/*" :maxFileSize="1000000" @select="onSelectedFiles">
                    <template #header="{ chooseCallback }">
                        <div class="flex items-center justify-between mb-2 w-full">
                            <label class="font-bold">Hình ảnh</label>
                            <div class="flex gap-2">
                                <Button @click="chooseCallback()" icon="pi pi-images" rounded outlined severity="secondary"></Button>
                            </div>
                        </div>
                    </template>
                    <template #content>
                        <div class="flex flex-wrap gap-4">
                            <div v-for="file of mergedImageList" :key="file.key" class="relative w-[100px] h-[80px] rounded-lg border border-surface overflow-hidden flex-shrink-0">
                                <div class="relative rounded-lg border border-surface overflow-hidden flex-shrink-0">
                                    <button @click="handleRemoveImage(file)" class="absolute top-0 right-0 w-6 h-6 text-red-500 flex items-center justify-center z-10 hover:bg-red-100">
                                        <i class="pi pi-times text-xs"></i>
                                    </button>

                                    <Image :src="file.url" :alt="file.name" preview class="w-full h-full" />
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-center flex-col">
                            <i class="pi pi-cloud-upload !border-2 !rounded-full !p-5 !text-4xl !text-muted-color" />
                            <p class="mt-6 mb-0">Kéo hoặc paste ảnh vào đây.</p>
                        </div>
                    </template>
                </FileUpload>
            </div>

            <template #footer>
                <Button label="Hủy" icon="pi pi-times" text @click="productDialog = false" />
                <Button label="Lưu" icon="pi pi-check" type="submit" @click="submit" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deleteProductDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Xác nhận" :modal="true">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle !text-3xl" />
                <span v-if="product">
                    Bạn có chắc chắn muốn xóa căn hộ <b>{{ product.apartmentCode }} này không</b>?
                </span>
            </div>
            <template #footer>
                <Button label="Hủy" icon="pi pi-times" text @click="deleteProductDialog = false" />
                <Button label="Xác nhận" icon="pi pi-check" @click="deleteProduct" />
            </template>
        </Dialog>

        <Dialog v-model:visible="deleteProductsDialog" class="w-[90vw] sm:w-[350px] md:w-[450px]" header="Xác nhận" :modal="true">
            <div class="flex items-center gap-4">
                <i class="pi pi-exclamation-triangle !text-3xl" />
                <span v-if="product">Bạn có chắc chắc muốn xóa các căn hộ này không?</span>
            </div>
            <template #footer>
                <Button label="No" icon="pi pi-times" text @click="deleteProductsDialog = false" />
                <Button label="Yes" icon="pi pi-check" text @click="deleteSelectedProducts" />
            </template>
        </Dialog>
        <FullscreenImageGallery v-model:visible="showImageGalery" :images="imageGalery" :show-thumbnails="true" />
        <Drawer v-model:visible="fullScreen" header="Danh sách căn hộ" position="full">
            <div class="responsive-zoom-table">
                <DataTable
                    ref="dt"
                    :value="virtualProducts"
                    dataKey="id"
                    size="small"
                    v-model:selection="selectedProducts"
                    :filters="filters"
                    resizableColumns
                    columnResizeMode="expand"
                    stripedRows
                    reorderableColumns
                    scrollable
                    scrollHeight="flex"
                    scrollDirection="horizontal"
                    class="p-datatable-sm"
                    filterDisplay="menu"
                    tableStyle="min-width: 50rem"
                    :virtualScrollerOptions="{
                        lazy: true,
                        onLazyLoad: loadProductsLazy,
                        itemSize: 60,
                        delay: 0,
                        showLoader: true,
                        loading: lazyLoading,
                        numToleratedItems: 5,
                        step: 5
                    }"
                    :sortField="currentSort.sortBy"
                    :sortOrder="currentSort.sortOrder === 'ASC' ? 1 : -1"
                    @columnReorder="onColumnReorder"
                    @sort="onSort"
                    @filter="onFilter"
                >
                    <template #empty>
                        <span>Không có căn hộ nào.</span>
                    </template>

                    <template #header>
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 w-full">
                            <div class="flex items-end gap-2">
                                <IconField class="w-full">
                                    <InputIcon>
                                        <i class="pi pi-search" />
                                    </InputIcon>
                                    <InputText v-model="filters['global'].value" class="w-full" placeholder="Tìm kiếm..." />
                                </IconField>
                                <Button type="button" @click="resetData" icon="pi pi-refresh" text />
                            </div>
                        </div>
                    </template>
                    <!-- Cột số thứ tự -->
                    <Column header="STT" :frozen="!isMobile" :sortable="false">
                        <template #body="{ index }">
                            <div class="flex items-center justify-center">
                                <span class="font-bold">{{ getRowIndex(index) }}</span>
                            </div>
                        </template>
                        <template #loading>
                            <div class="flex items-center justify-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                                <Skeleton width="2rem" height="1rem" />
                            </div>
                        </template>
                    </Column>
                    <Column
                        v-for="item in columns"
                        :sortable="item.sortable !== false"
                        :key="item.key"
                        :sortField="item.key"
                        :showFilterMatchModes="false"
                        :frozen="isMobile ? item.mobileFrozen : item.frozen"
                        :style="getColumnStyle(item)"
                        :class="item.frozen ? 'font-bold' : ''"
                    >
                        <template #body="{ data }">
                            <!-- Hiển thị skeleton cho placeholder -->
                            <div v-if="!data || data.isPlaceholder" class="flex items-center" style="height: 17px">
                                <Skeleton :width="item.type === 'tag' ? '80%' : item.type === 'phone' ? '70%' : '60%'" height="1rem" />
                            </div>
                            <!-- Render data với v-else-if để tối ưu -->
                            <template v-else>
                                <div v-if="item.type === 'tag'" class="flex items-center gap-2">
                                    <Tag :value="!item.text ? data[item.key] : item.text(data[item.key])" :severity="item.color(data[item.key])" :style="{ backgroundColor: item.color(data[item.key]), color: '#000' }" />
                                </div>
                                <div v-else-if="item.type === 's'" class="flex items-center gap-2 justify-end">
                                    <span>{{ Number(data[item.key] || 0) }}m²</span>
                                </div>
                                <div v-else-if="item.type === 'money'" class="flex items-center gap-2 justify-end">{{ Number(data[item.key] || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) }}tr</div>
                                <div v-else-if="item.type === 'images'" class="flex items-center justify-center gap-2">
                                    <Button v-if="data[item.key]?.length > 0" @click="showImages(data[item.key])" icon="pi pi-images" outlined rounded severity="info" />
                                    <span v-else>Không có ảnh</span>
                                </div>
                                <div v-else-if="item.type === 'phone'" class="flex items-center gap-2">
                                    <a v-if="data[item.key]" :href="`tel:${data[item.key]}`" class="inline-flex items-center gap-1 text-gray-700 hover:text-blue-500">
                                        <i class="pi pi-phone text-lg"></i>
                                        <span>{{ formatPhoneNumber(data[item.key]) }}</span>
                                    </a>
                                </div>
                                <div v-else-if="item.type === 'date'" class="flex items-center gap-2">
                                    <span>{{ data[item.key] ? format(new Date(data[item.key]), 'yyyy-MM-dd') : null }}</span>
                                </div>
                                <div v-else class="flex items-center gap-2">
                                    <span>{{ data[item.key] || '' }}</span>
                                </div>
                            </template>
                        </template>

                        <template #loading>
                            <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                                <Skeleton :width="item.type === 'tag' ? '80%' : item.type === 'phone' ? '70%' : '60%'" height="1rem" />
                            </div>
                        </template>

                        <template #header>
                            <div class="relative w-full h-full">
                                <span class="inline-block font-bold">{{ item.label }}</span>

                                <i
                                    class="pi pi-filter absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer"
                                    v-if="item.filterable"
                                    :class="filters[item.key]?.value?.length ? 'text-blue-500' : 'text-gray-400 hover:text-gray-700'"
                                    @click.stop="toggleFilterFull(item.key)"
                                ></i>

                                <MultiSelect
                                    v-if="item.filterable"
                                    :ref="(el) => setMultiSelectFullRef(item.key, el)"
                                    v-model="filters[item.key].value"
                                    :options="filterOptions[item.key]"
                                    @change="onFilter"
                                    filter
                                    display="chip"
                                    panelClass="z-50"
                                    panelStyle="width: 150px"
                                    placeholder="Lọc..."
                                    class="absolute top-full right-0 w-0 h-0 p-0 overflow-hidden border-none shadow-none focus:ring-0"
                                >
                                    <template #option="slotProps">
                                        <div v-if="item.type === 'tag'" class="flex items-center gap-2">
                                            <Tag :value="!item.text ? slotProps.option : item.text(slotProps.option)" :severity="item.color(slotProps.option)" :style="{ backgroundColor: item.color(slotProps.option), color: '#000' }" />
                                        </div>
                                        <div v-else-if="item.type === 's'" class="flex items-center gap-2 justify-end">
                                            <span>{{ Number(slotProps.option) }}m²</span>
                                        </div>
                                        <div v-else-if="item.type === 'money'" class="flex items-center gap-2 justify-end">{{ Number(slotProps.option).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) }}tr</div>
                                        <div v-else-if="item.type === 'link'" class="flex items-center gap-2">
                                            <i class="pi pi-paperclip"></i>
                                            <span>Hình ảnh</span>
                                        </div>
                                        <div v-else-if="item.type === 'date'" class="flex items-center gap-2">
                                            <span>{{ slotProps.option ? format(new Date(slotProps.option), 'yyyy-MM-dd') : null }}</span>
                                        </div>
                                        <div v-else-if="item.type === 'phone'" class="flex items-center gap-2">
                                            <span>{{ formatPhoneNumber(slotProps.option) }}</span>
                                        </div>
                                        <div v-else class="flex items-center gap-2">
                                            <span>{{ slotProps.option }}</span>
                                        </div>
                                    </template>
                                    <template #footer>
                                        <div class="flex justify-end p-2 border-t">
                                            <button type="button" class="text-xs text-blue-500 hover:underline" @click.stop="clearFilter(item.key)">Xóa lọc</button>
                                        </div>
                                    </template>
                                </MultiSelect>
                            </div>
                        </template>
                    </Column>

                    <Column :exportable="false" style="min-width: 12rem; height: 60px">
                        <template #body="{ data }">
                            <!-- Skeleton cho placeholder -->
                            <div v-if="!data || data.isPlaceholder" class="flex items-center gap-2" style="height: 17px">
                                <Skeleton width="2rem" height="2rem" class="rounded-full" />
                                <Skeleton width="2rem" height="2rem" class="rounded-full" />
                            </div>
                            <!-- Action buttons -->
                            <div v-else class="flex items-center gap-2">
                                <Button icon="pi pi-pencil" outlined rounded size="small" @click="editProduct(data)" />
                                <Button icon="pi pi-trash" outlined rounded size="small" severity="danger" @click="confirmDeleteProduct(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </div>
        </Drawer>
    </div>
</template>
<style scoped>
.responsive-zoom-table {
    transform-origin: top left;
    width: 100%;
    height: 100%;
}

/* Chỉ áp dụng khi chiều rộng nhỏ hơn 768px (điện thoại) */
@media screen and (max-width: 768px) {
    :deep(.p-datatable) {
        font-size: 0.85rem;
    }

    :deep(.p-column-header-content),
    :deep(.p-cell-content) {
        padding: 0.25rem 0.5rem;
    }
}
</style>