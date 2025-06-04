<script setup>
import FullscreenImageGallery from '@/components/galeria/FullscreenImageGallery.vue';
import MobilePasteFileUpload from '@/components/MobilePasteFileUpload.vue';
import ProductDataTable from '@/components/ProductDataTable.vue';
import { authService } from '@/service/AuthService';
import { productService } from '@/service/ProductService';
import { socketService } from '@/service/SocketService';
import { sortPreferencesService } from '@/service/SortPreferencesService';
import { useMenuStore } from '@/stores/menuStore';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const menuStore = useMenuStore();
const socketCleanups = ref([]);
const initialImages = ref([]);
const pendingImages = ref([]);
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
const pageInfo = computed(() => {
    // Lấy dữ liệu từ menu store
    const menuData = menuStore.menuData || [];

    let subdivisionName = '';
    let apartmentTypeName = '';

    // Tìm subdivision và apartment type từ menu data
    for (const subdivisionItem of menuData) {
        if (subdivisionItem.id === subdivision.value) {
            subdivisionName = subdivisionItem.name;

            // Tìm apartment type trong children
            if (subdivisionItem.children) {
                const apartmentTypeItem = subdivisionItem.children.find((child) => child.id === apartmentType.value);
                if (apartmentTypeItem) {
                    apartmentTypeName = apartmentTypeItem.name;
                }
            }
            break;
        }
    }

    return {
        subdivisionName: subdivisionName || 'N/A',
        apartmentTypeName: apartmentTypeName || 'N/A'
    };
});

// Computed để tạo tiêu đề header
const pageTitle = computed(() => {
    const { subdivisionName, apartmentTypeName } = pageInfo.value;
    return `${subdivisionName} - ${apartmentTypeName}`;
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

// Các methods để handle events từ ProductDataTable component
const handleSort = (event) => {
    const newSortBy = event.sortField;
    const newSortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';

    currentSort.value = {
        sortBy: newSortBy,
        sortOrder: newSortOrder
    };

    lazyParams.value.sortBy = newSortBy;
    lazyParams.value.sortOrder = newSortOrder;

    resetData();
};

const handleRowReorder = async (reorderData) => {
    console.log('🔄 Row reorder event received:', reorderData);

    try {
        const { oldIndex, newIndex, draggedItem, newOrder } = reorderData;

        // Validate the reorder data
        if (!draggedItem || !draggedItem.id) {
            toast.add({
                severity: 'error',
                summary: 'Lỗi',
                detail: 'Không thể xác định sản phẩm được di chuyển',
                life: 3000
            });
            return;
        }

        // Show loading state
        const loadingToastId = Date.now();
        toast.add({
            id: loadingToastId,
            severity: 'info',
            summary: 'Đang lưu thứ tự...',
            detail: `Di chuyển "${draggedItem.apartmentCode}" từ vị trí ${oldIndex + 1} đến ${newIndex + 1}`,
            life: 5000
        });

        // Update local state immediately for better UX
        const updatedProducts = [...virtualProducts.value];
        const [movedItem] = updatedProducts.splice(oldIndex, 1);
        updatedProducts.splice(newIndex, 0, movedItem);
        virtualProducts.value = updatedProducts;

        // Filter out placeholder items and prepare API call
        const orderUpdates = newOrder.filter((item) => item.id && !item.id.startsWith('placeholder-'));

        // Call API endpoint to save the order
        await productService.updateProductOrders({
            apartmentType: apartmentType.value,
            subdivision: subdivision.value,
            orderUpdates
        });

        // Clear loading toast
        toast.remove(loadingToastId);

        // Show success message
        toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: `Đã cập nhật thứ tự cho "${draggedItem.apartmentCode}"`,
            life: 3000
        });

        // Optionally refresh data to ensure consistency
        // Comment out if you want to keep optimistic updates
        // resetData();
    } catch (error) {
        console.error('❌ Error updating row order:', error);

        // Revert local changes on error
        resetData();

        toast.add({
            severity: 'error',
            summary: 'Lỗi',
            detail: 'Không thể cập nhật thứ tự. Đã khôi phục trạng thái ban đầu.',
            life: 5000
        });
    }
};

const handleFilter = () => {
    if (!isInitialized.value) return;

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

const handleRefresh = () => {
    resetData();
};

const handleFullscreen = () => {
    fullScreen.value = true;
};

const handleShowImages = (images) => {
    showImages(images);
};

const handleEditProduct = (data) => {
    editProduct(data);
};

const handleDeleteProduct = (data) => {
    confirmDeleteProduct(data);
};

const handleLazyLoad = (event) => {
    loadProductsLazy(event);
};
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
// Socket functions - Fixed version
const initializeSocket = () => {
    try {
        socketService.connect();

        // Wait for connection before joining room
        setTimeout(() => {
            if (subdivision.value && apartmentType.value) {
                socketService.joinProductRoom(subdivision.value, apartmentType.value);
            }

            // Setup event listeners after connection
            setupSocketListeners();
        }, 1000);
    } catch (error) {
        console.error('Failed to initialize socket:', error);
    }
};

const updateSocketRoom = () => {
    if (!socketService.isConnected()) {
        return;
    }

    // Leave old room and join new room
    if (socketService.currentRoom) {
        const { subdivision: oldSub, apartmentType: oldType } = socketService.currentRoom;
        socketService.leaveProductRoom(oldSub, oldType);
    }

    if (subdivision.value && apartmentType.value) {
        socketService.joinProductRoom(subdivision.value, apartmentType.value);
    }
};

const setupSocketListeners = () => {
    // Clean up existing listeners
    cleanupSocket();

    // Product created
    const cleanupCreated = socketService.onProductCreated((event) => {
        // Check if this event is for current room
        if (isEventForCurrentRoom(event.data)) {
            handleProductCreated(event.data);
            toast.add({
                severity: 'info',
                summary: 'Sản phẩm mới',
                detail: `Căn hộ ${event.data.apartmentCode} vừa được thêm`,
                life: 3000
            });
        } else {
            console.log('❌ Event is not for current room, ignoring');
        }
    });

    // Product updated
    const cleanupUpdated = socketService.onProductUpdated((event) => {
        if (isEventForCurrentRoom(event.data)) {
            handleProductUpdated(event.data);
            toast.add({
                severity: 'info',
                summary: 'Cập nhật sản phẩm',
                detail: `Căn hộ ${event.data.apartmentCode} vừa được cập nhật`,
                life: 3000
            });
        } else {
            console.log('❌ Event is not for current room, ignoring');
        }
    });

    // Product deleted
    const cleanupDeleted = socketService.onProductDeleted((event) => {
        // For delete events, we don't need to check room since we only have the ID
        handleProductDeleted(event.data.id);
        toast.add({
            severity: 'warn',
            summary: 'Xóa sản phẩm',
            detail: `Căn hộ ${event.data.apartmentCode} đã bị xóa`,
            life: 3000
        });
    });

    // Store cleanup functions
    socketCleanups.value = [cleanupCreated, cleanupUpdated, cleanupDeleted];
};

// Helper function to check if event is for current room
const isEventForCurrentRoom = (productData) => {
    if (!productData) {
        return false;
    }

    // Handle both cases: when productData has subdivision/apartmentType as objects or when they're IDs
    const productSubdivision = productData.subdivision?.id || productData.subdivision;
    const productApartmentType = productData.apartmentType?.id || productData.apartmentType;

    return productSubdivision === subdivision.value && productApartmentType === apartmentType.value;
};

const cleanupSocket = () => {
    // Clean up listeners
    socketCleanups.value.forEach((cleanup) => cleanup());
    socketCleanups.value = [];
};

// Handle real-time updates - Enhanced version
const handleProductCreated = (newProduct) => {
    // Add to virtual products array at the beginning
    const updatedProducts = [newProduct, ...virtualProducts.value.filter((p) => !p.isPlaceholder)];

    // Update total records
    totalRecords.value += 1;

    // Recreate virtual array with new total
    virtualProducts.value = Array.from({ length: totalRecords.value }, (_, index) => {
        if (index < updatedProducts.length) {
            return { ...updatedProducts[index], isPlaceholder: false };
        }
        return {
            id: `placeholder-${index}`,
            isPlaceholder: true
        };
    });

    // Clear loaded pages cache to force reload
    loadedPages.value.clear();
    loadedPages.value.add(1); // Mark first page as loaded

    // Update filter options
    nextTick(() => {
        fetchFilterOptions();
    });
};

const handleProductUpdated = (updatedProduct) => {
    // Find and update in virtual products array
    const index = virtualProducts.value.findIndex((p) => p?.id === updatedProduct.id);
    if (index !== -1) {
        virtualProducts.value[index] = { ...updatedProduct };
        // Trigger reactivity
        virtualProducts.value = [...virtualProducts.value];
    } else {
        console.log('Product not found in current view, might be in different page');
    }

    // Update filter options
    nextTick(() => {
        fetchFilterOptions();
    });
};

const handleProductDeleted = (productId) => {
    // Find and remove from virtual products array
    const index = virtualProducts.value.findIndex((p) => p?.id === productId);
    if (index !== -1) {
        // Remove from array
        const filteredProducts = virtualProducts.value.filter((p) => p?.id !== productId && !p.isPlaceholder);

        // Update total records
        totalRecords.value = Math.max(0, totalRecords.value - 1);

        // Recreate virtual array
        virtualProducts.value = Array.from({ length: totalRecords.value }, (_, index) => {
            if (index < filteredProducts.length) {
                return { ...filteredProducts[index], isPlaceholder: false };
            }
            return {
                id: `placeholder-${index}`,
                isPlaceholder: true
            };
        });

        // Clear loaded pages cache
        loadedPages.value.clear();
        if (totalRecords.value > 0) {
            loadedPages.value.add(1);
        }
    }

    // Update filter options
    nextTick(() => {
        fetchFilterOptions();
    });
};

// Enhanced cleanup in onBeforeUnmount
onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);

    // Clean up socket
    cleanupSocket();

    // Disconnect socket
    if (socketService.isConnected()) {
        if (subdivision.value && apartmentType.value) {
            socketService.leaveProductRoom(subdivision.value, apartmentType.value);
        }
        socketService.disconnect();
    }
});
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
    virtualProducts.value = [];
    totalRecords.value = 0;
    loadedPages.value.clear();
    selectedProducts.value = [];
    fetchInitialData();
}

// Fetch initial data để biết total records - chỉ load page đầu
async function fetchInitialData() {
    if (!lazyParams.value.apartmentType || !lazyParams.value.subdivision) {
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
        }

        // Force reactivity update
        virtualProducts.value = [...virtualProducts.value];
    } catch (err) {
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
        toast.add({ severity: 'error', summary: 'Lỗi', detail: 'Không tải được sản phẩm' });
    } finally {
        lazyLoading.value = false;
    }
};

const filterOptions = ref({
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
    errors.apartmentCode = !form.value.apartmentCode ? 'Vui lòng nhập mã căn' : '';
    errors.area = !form.value.area ? 'Vui lòng nhập diện tích' : '';
    errors.sellingPrice = !form.value.sellingPrice ? 'Vui lòng nhập giá bán' : '';
    errors.status = !form.value.status ? 'Vui lòng chọn tình trạng' : '';
    return Object.values(errors).every((e) => !e);
};

const onFilter = () => {
    // Chỉ filter khi đã khởi tạo
    if (!isInitialized.value) return;

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

    // Add pending files
    pendingImages.value.forEach((file) => {
        data.append('images', file);
    });

    // Add initial image IDs (for updates)
    initialImages.value.forEach((img) => {
        data.append('imageIds', img.id);
    });
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
    initialImages.value = [];
    pendingImages.value = [];
    productDialog.value = true;
}

function hideDialog() {
    productDialog.value = false;
    submitted.value = false;
}

const editProduct = (prod) => {
    form.value = { ...prod };
    initialImages.value = prod.imageList || [];
    pendingImages.value = [];
    productDialog.value = true;
};

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
    { key: 'apartmentCode', label: 'Mã căn', frozen: true, mobileFrozen: true, width: 5, mobileWidth: 4, maxWidth: 8 },
    { key: 'apartmentEncode', label: 'Mã căn x', frozen: true, mobileFrozen: true, width: 5, mobileWidth: 4 },
    { key: 'area', label: 'S', type: 's', width: 5, mobileWidth: 4, filterable: true, maxWidth: 6.5 },
    { key: 'sellingPrice', label: 'Giá bán', width: 6, maxWidth: 6.5 },
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

// Helper function to check if file is video
const isVideoFile = (file) => {
    if (!file) return false;

    // Check by file type
    if (file.type && file.type.startsWith('video/')) return true;

    // Check by file name extension
    if (file.name) {
        const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|mkv|flv|m4v|3gp)$/i;
        return videoExtensions.test(file.name);
    }

    // Check by URL
    if (file.url) {
        const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|mkv|flv|m4v|3gp)$/i;
        return videoExtensions.test(file.url);
    }

    return false;
};
// Update onFilesUpdated to handle preview properly
const onFilesUpdated = (data) => {
    // Update pending files (these are files selected but not yet submitted)
    pendingImages.value = data.pending;

    console.log('Files updated:', {
        pending: data.pending.length,
        initial: data.initial.length,
        all: data.all.length
    });

    // Show preview feedback if files were added
    if (data.pending.length > 0) {
        const imageCount = data.pending.filter((f) => !isVideoFile(f)).length;
        const videoCount = data.pending.filter((f) => isVideoFile(f)).length;

        const parts = [];
        if (imageCount > 0) parts.push(`${imageCount} ảnh`);
        if (videoCount > 0) parts.push(`${videoCount} video`);

        console.log(`Preview ready: ${parts.join(' + ')}`);
    }
};

const onFileRemoved = (data) => {
    if (data.type === 'initial') {
        // Remove from initial files
        initialImages.value = initialImages.value.filter((img) => img.id !== data.file.id);
    }
    // Pending files đã được handle tự động trong component
};

const onPasteSuccess = (data) => {
    console.log(`${data.count} ảnh đã được paste thành công`);
};

const onPasteError = (data) => {
    console.error('Paste error:', data.message);
};

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
const showImages = (mediaList) => {
    if (!mediaList || mediaList.length === 0) return;

    imageGalery.value = mediaList.map((item, index) => ({
        src: import.meta.env.VITE_API_URL + item.url,
        alt: `Media ${index + 1}`,
        type: item.mimeType || getMediaType(item.url),
        name: item.name || `media-${index + 1}`
    }));

    showImageGalery.value = true;
};
const getMediaType = (url) => {
    if (!url) return 'image/jpeg';

    const extension = url.split('.').pop()?.toLowerCase();
    const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'mkv', 'flv', 'm4v', '3gp'];

    if (videoExtensions.includes(extension)) {
        switch (extension) {
            case 'mov':
                return 'video/quicktime';
            case 'm4v':
                return 'video/mp4';
            case '3gp':
                return 'video/3gpp';
            default:
                return `video/${extension}`;
        }
    }

    // Image types
    switch (extension) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        case 'bmp':
            return 'image/bmp';
        case 'tiff':
            return 'image/tiff';
        case 'svg':
            return 'image/svg+xml';
        default:
            return 'image/jpeg';
    }
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
        <div class="card">
            <Toolbar class="mb-4 sm:mb-6">
                <template #start>
                    <div class="flex flex-wrap gap-2">
                        <Button label="Thêm" icon="pi pi-plus" severity="secondary" size="small" @click="openNew" class="text-sm" />
                        <Button label="Xóa" v-if="isAdmin" icon="pi pi-trash" severity="secondary" size="small" @click="confirmDeleteSelected" :disabled="!selectedProducts || !selectedProducts.length" class="text-sm" />
                    </div>
                </template>
                <template #end>
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-surface-600 dark:text-surface-400 hidden sm:inline"> {{ selectedProducts?.length || 0 }} đã chọn </span>
                    </div>
                </template>
            </Toolbar>

            <ProductDataTable
                ref="mainDataTable"
                :virtual-products="virtualProducts"
                :selected-products="selectedProducts || []"
                @update:selected-products="selectedProducts = $event || []"
                :filters="filters"
                :filter-options="filterOptions"
                :columns="columns"
                :total-records="totalRecords"
                :lazy-loading="lazyLoading"
                :current-sort="currentSort"
                :is-mobile="isMobile"
                :is-admin="isAdmin"
                :lazy-params="lazyParams"
                :scroll-height="'600px'"
                @sort="handleSort"
                @filter="handleFilter"
                @refresh="handleRefresh"
                @fullscreen="handleFullscreen"
                @show-images="handleShowImages"
                @edit-product="handleEditProduct"
                @delete-product="handleDeleteProduct"
                @lazy-load="handleLazyLoad"
                @row-reorder="handleRowReorder"
            />
        </div>

        <Dialog v-model:visible="productDialog" class="w-[90vw] sm:w-[500px] md:w-[600px]" header="Thông tin căn hộ" :modal="true">
            <form @submit.prevent="submit" class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div class="flex flex-col gap-y-2 md:col-span-2">
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
                    <InputText v-model="form.apartmentContactInfo" class="w-full text-right" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Liên hệ</label>
                    <InputText v-model="form.contactInfo" class="w-full text-right" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Báo nguồn</label>
                    <InputText v-model="form.source" class="w-full text-right" />
                </div>

                <div class="flex flex-col gap-y-2">
                    <label>Tình trạng <span class="text-red-500">*</span></label>
                    <Dropdown v-model="form.status" :options="statusOptions" optionLabel="label" optionValue="value" class="w-full" :invalid="!!errors.status" />
                    <small v-if="errors.status" class="text-red-500">{{ errors.status }}</small>
                </div>
            </form>
            <MobilePasteFileUpload
                :initial-files="initialImages"
                :multiple="true"
                :max-file-size="50000000"
                accept="image/*,video/*,.mp4,.avi,.mov,.wmv,.webm,.ogg,.mkv,.flv,.m4v,.3gp,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                label="Hình ảnh & Video"
                :support-video="true"
                :support-image="true"
                @files-updated="onFilesUpdated"
                @file-removed="onFileRemoved"
                @paste-success="onPasteSuccess"
                @paste-error="onPasteError"
            />
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
            </template> </Dialog
        ><FullscreenImageGallery v-model:visible="showImageGalery" :media="imageGalery" :show-thumbnails="true" />
        <Drawer v-model:visible="fullScreen" header="Danh sách căn hộ" position="full">
            <div class="responsive-zoom-table">
                <ProductDataTable
                    ref="mainDataTable"
                    :virtual-products="virtualProducts"
                    v-model:selected-products="selectedProducts"
                    :filters="filters"
                    :filter-options="filterOptions"
                    :columns="columns"
                    :total-records="totalRecords"
                    :lazy-loading="lazyLoading"
                    :current-sort="currentSort"
                    :is-mobile="isMobile"
                    :is-admin="isAdmin"
                    :lazy-params="lazyParams"
                    @sort="handleSort"
                    @filter="handleFilter"
                    @refresh="handleRefresh"
                    @fullscreen="handleFullscreen"
                    @show-images="handleShowImages"
                    @edit-product="handleEditProduct"
                    @delete-product="handleDeleteProduct"
                    @lazy-load="handleLazyLoad"
                    @row-reorder="handleRowReorder"
                />
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