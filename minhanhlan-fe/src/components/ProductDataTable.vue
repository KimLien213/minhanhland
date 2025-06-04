<!-- src/components/ProductDataTable.vue - Fixed Checkbox Selection -->
<template>
    <DataTable
        ref="dt"
        :value="virtualProducts"
        dataKey="id"
        size="small"
        v-model:selection="internalSelection"
        @update:selection="handleSelectionUpdate"
        :filters="filters"
        resizableColumns
        columnResizeMode="expand"
        stripedRows
        scrollable
        :scrollHeight="scrollHeight"
        scrollDirection="horizontal"
        filterDisplay="menu"
        tableStyle="min-width: 100%; width: 100%;"
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
        @sort="!isDragMode && $emit('sort', $event)"
        @filter="$emit('filter')"
        :class="[tableClass, 'sortable-datatable', { 'drag-mode': isDragMode }]"
    >
        <template #empty>
            <span>Không có căn hộ nào.</span>
        </template>

        <template #header>
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
                <div class="flex items-start gap-2">
                    <span class="text-sm font-bold">Tổng số: {{ totalRecords }} căn hộ</span>
                    <div class="flex items-center gap-2" v-if="isDragMode">
                        <Tag value="Chế độ kéo thả" severity="success" size="small" />
                        <i class="pi pi-arrows-v text-green-500 animate-pulse"></i>
                    </div>
                </div>
                <div class="flex items-end gap-2">
                    <IconField class="w-full">
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="filters.global.value" class="w-full" placeholder="Tìm kiếm..." :disabled="isDragMode" />
                    </IconField>

                    <!-- Toggle Drag Mode Button -->
                    <Button
                        v-if="isAdmin"
                        type="button"
                        :icon="isDragMode ? 'pi pi-times' : 'pi pi-arrows-v'"
                        :severity="isDragMode ? 'danger' : 'success'"
                        :outlined="!isDragMode"
                        @click="toggleDragMode"
                        v-tooltip.top="isDragMode ? 'Tắt chế độ kéo thả' : 'Bật chế độ kéo thả'"
                        text
                    />

                    <Button type="button" @click="$emit('refresh')" icon="pi pi-refresh" text :disabled="isDragMode" />
                    <Button v-if="!isFullscreen" type="button" icon="pi pi-window-maximize" @click="$emit('fullscreen')" text :disabled="isDragMode" />
                </div>
            </div>
        </template>

        <!-- Selection Column -->
        <Column selectionMode="multiple" v-if="isAdmin" :frozen="!isMobile" style="width: 2rem; height: 60px" :exportable="false">
            <template #loading>
                <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                    <Skeleton width="100%" height="1rem" />
                </div>
            </template>
        </Column>

        <!-- Drag Handle Column - Only show when in drag mode -->
        <Column v-if="isDragMode" header="" :frozen="!isMobile" style="width: 3rem; height: 60px" :exportable="false" :sortable="false">
            <template #header>
                <div class="flex items-center justify-center">
                    <i class="pi pi-bars text-muted-color"></i>
                </div>
            </template>
            <template #body="{ data }">
                <div v-if="!data || data.isPlaceholder" class="flex items-center justify-center" style="height: 17px">
                    <Skeleton width="1.5rem" height="1rem" />
                </div>
                <div v-else class="sortable-handle flex items-center justify-center cursor-grab active:cursor-grabbing p-2 rounded hover:bg-surface-100">
                    <i class="pi pi-bars text-muted-color"></i>
                </div>
            </template>
            <template #loading>
                <div class="flex items-center justify-center" style="height: 17px">
                    <Skeleton width="1.5rem" height="1rem" />
                </div>
            </template>
        </Column>

        <!-- STT Column -->
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

        <!-- Dynamic Columns -->
        <Column
            v-for="item in columns"
            :sortable="(item.sortable !== false && isAdmin && !isDragMode) || item.key === 'sellingPrice'"
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
                    <Skeleton :width="getSkeletonWidth(item)" height="1rem" />
                </div>
                <!-- Render data -->
                <template v-else>
                    <div v-if="item.type === 'tag'" class="flex items-center gap-2">
                        <Tag :value="!item.text ? data[item.key] : item.text(data[item.key])" :severity="item.color(data[item.key])" :style="{ backgroundColor: item.color(data[item.key]), color: '#000' }" />
                    </div>
                    <div v-else-if="item.type === 's'" class="flex items-center gap-2 justify-end">
                        <span>{{ Number(data[item.key] || 0) }}m²</span>
                    </div>
                    <div v-else-if="item.type === 'money'" class="flex items-center gap-2 justify-end">{{ Number(data[item.key] || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) }}tr</div>
                    <!-- In the dynamic columns section, update the images/media column -->
                    <div v-else-if="item.type === 'images'" class="flex items-center justify-center gap-2">
                        <Button
                            v-if="data[item.key]?.length > 0"
                            @click="$emit('show-images', data[item.key])"
                            :icon="hasVideo(data[item.key]) ? 'pi pi-video' : 'pi pi-images'"
                            outlined
                            rounded
                            :severity="hasVideo(data[item.key]) ? 'info' : 'secondary'"
                            :label="getMediaCountLabel(data[item.key])"
                            size="small"
                        />
                        <span v-else>Không có file</span>
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
                    <Skeleton :width="getSkeletonWidth(item)" height="1rem" />
                </div>
            </template>

            <template #header>
                <div class="relative w-full h-full flex items-center justify-between">
                    <span class="font-bold">{{ item.label }}</span>

                    <!-- Luôn có container cho icon, dù có filter hay không -->
                    <div class="w-4 h-4 flex items-center justify-center">
                        <i v-if="item.filterable && !isDragMode" class="pi pi-filter cursor-pointer text-xs" :class="filters[item.key]?.value?.length ? 'text-blue-500' : 'text-gray-400 hover:text-gray-700'" @click.stop="toggleFilter(item.key)"></i>
                    </div>

                    <MultiSelect
                        v-if="item.filterable && !isDragMode"
                        :ref="(el) => setMultiSelectRef(item.key, el)"
                        v-model="filters[item.key].value"
                        :options="filterOptions[item.key]"
                        @change="$emit('filter')"
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

        <!-- Actions Column -->
        <Column :exportable="false" v-if="isAdmin" style="min-width: 120px; width: 120px; max-width: 120px" headerStyle="min-width: 120px; width: 120px;" bodyStyle="min-width: 120px; width: 120px;">
            <template #header>
                <span class="font-bold">Thao tác</span>
            </template>
            <template #body="{ data }">
                <!-- Skeleton cho placeholder -->
                <div v-if="!data || data.isPlaceholder" class="flex items-center gap-2" style="height: 17px">
                    <Skeleton width="2rem" height="2rem" class="rounded-full" />
                    <Skeleton width="2rem" height="2rem" class="rounded-full" />
                </div>
                <!-- Action buttons -->
                <div v-else class="flex items-center gap-2 justify-center">
                    <Button icon="pi pi-pencil" outlined rounded size="small" @click="$emit('edit-product', data)" :disabled="isDragMode" />
                    <Button icon="pi pi-trash" outlined rounded size="small" severity="danger" @click="$emit('delete-product', data)" :disabled="isDragMode" />
                </div>
            </template>
        </Column>
    </DataTable>
</template>

<script setup>
import { format } from 'date-fns';
import Sortable from 'sortablejs';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

// Props
const props = defineProps({
    virtualProducts: { type: Array, default: () => [] },
    selectedProducts: { type: Array, default: () => [] },
    filters: { type: Object, required: true },
    filterOptions: { type: Object, default: () => ({}) },
    columns: { type: Array, default: () => [] },
    totalRecords: { type: Number, default: 0 },
    lazyLoading: { type: Boolean, default: false },
    currentSort: { type: Object, default: () => ({ sortBy: null, sortOrder: 'DESC' }) },
    isMobile: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    lazyParams: { type: Object, required: true },
    scrollHeight: { type: String, default: 'flex' },
    tableClass: { type: String, default: '' },
    isFullscreen: { type: Boolean, default: false }
});

// Emits
const emit = defineEmits(['update:selectedProducts', 'sort', 'filter', 'refresh', 'fullscreen', 'show-images', 'edit-product', 'delete-product', 'lazy-load', 'row-reorder']);

// Reactive refs for MultiSelect and SortableJS
const multiSelectRefs = reactive({});
const dt = ref(null);
const sortableInstance = ref(null);
const isDragMode = ref(false);
const internalSelection = ref([]);

// Watch for props changes
watch(
    () => props.selectedProducts,
    (newVal) => {
        if (Array.isArray(newVal)) {
            internalSelection.value = [...newVal];
        }
    },
    { immediate: true, deep: true }
);

// Selection management - Simplified version
const handleSelectionUpdate = (newSelection) => {
    // Update internal selection
    internalSelection.value = newSelection || [];

    // Filter out placeholder items and emit to parent
    const validSelection = (newSelection || []).filter((item) => item && typeof item === 'object' && item.id && !item.isPlaceholder);

    emit('update:selectedProducts', validSelection);
};

// Methods
const loadProductsLazy = (event) => {
    emit('lazy-load', event);
};

const onColumnReorder = (event) => {
    if (event.dragIndex === 0 || event.dropIndex === 0) {
        // Reset to default if trying to reorder frozen columns
        return false;
    }
};

const getRowIndex = (rowIndex) => {
    const currentPage = props.lazyParams.page || 1;
    const pageSize = props.lazyParams.limit || 20;
    return (currentPage - 1) * pageSize + rowIndex + 1;
};

const getColumnStyle = computed(() => {
    return (item) => ({
        minWidth: `${(props.isMobile ? item.mobileWidth || item.width : item.width) - (props.isAdmin ? 0 : item.filterable ? 1 : 2)}rem`,
        height: '60px',
        maxWidth: item.maxWidth ? `${item.maxWidth}rem` : undefined
    });
});

const getSkeletonWidth = (item) => {
    if (item.type === 'tag') return '80%';
    if (item.type === 'phone') return '70%';
    return '60%';
};

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

const toggleFilter = (key) => {
    if (!multiSelectRefs[key]) return;
    nextTick(() => {
        multiSelectRefs[key]?.show();
    });
};

const setMultiSelectRef = (key, el) => {
    if (el) {
        multiSelectRefs[key] = el;
    }
};

const clearFilter = (key) => {
    props.filters[key].value = null;
    emit('filter');
};

// SortableJS Integration - FIXED VERSION
const initializeSortable = () => {
    if (!dt.value || !isDragMode.value) return;

    // Wait for DOM to be ready
    nextTick(() => {
        const tableBody = dt.value.$el.querySelector('.p-datatable-tbody');
        if (!tableBody) {
            console.warn('Table body not found');
            return;
        }

        // Destroy existing instance if any
        destroySortable();

        // Create new Sortable instance
        sortableInstance.value = Sortable.create(tableBody, {
            handle: '.sortable-handle', // Changed from .drag-handle to .sortable-handle
            animation: 200,
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            ghostClass: 'sortable-ghost',
            forceFallback: true, // Force HTML5 DnD fallback
            fallbackClass: 'sortable-fallback',
            fallbackOnBody: true,
            swapThreshold: 0.65,

            // Filter out placeholder rows and empty message
            filter: (evt, item) => {
                const rowData = props.virtualProducts[item.rowIndex];
                return !rowData || rowData.isPlaceholder;
            },

            onStart: (evt) => {
                console.log('🎯 Drag started:', evt.oldIndex);
                document.body.classList.add('is-dragging');

                // Disable text selection during drag
                document.body.style.userSelect = 'none';
            },

            onEnd: (evt) => {
                console.log('🎯 Drag ended:', evt.oldIndex, '->', evt.newIndex);
                document.body.classList.remove('is-dragging');
                document.body.style.userSelect = '';

                // Only emit if position actually changed and indices are valid
                if (evt.oldIndex !== evt.newIndex && evt.oldIndex >= 0 && evt.newIndex >= 0 && evt.oldIndex < props.virtualProducts.length && evt.newIndex < props.virtualProducts.length) {
                    const draggedItem = props.virtualProducts[evt.oldIndex];

                    // Skip if dragged item is placeholder
                    if (!draggedItem || draggedItem.isPlaceholder) {
                        console.warn('Cannot reorder placeholder items');
                        return;
                    }

                    console.log('🔄 Reordering:', {
                        draggedItem: draggedItem?.apartmentCode || 'Unknown',
                        oldIndex: evt.oldIndex,
                        newIndex: evt.newIndex
                    });

                    // Create new order array
                    const newOrder = [...props.virtualProducts];
                    const [movedItem] = newOrder.splice(evt.oldIndex, 1);
                    newOrder.splice(evt.newIndex, 0, movedItem);

                    // Emit reorder event to parent
                    emit('row-reorder', {
                        oldIndex: evt.oldIndex,
                        newIndex: evt.newIndex,
                        draggedItem,
                        newOrder: newOrder
                            .filter((item) => !item.isPlaceholder)
                            .map((item, index) => ({
                                id: item.id,
                                order: index + 1
                            }))
                    });
                }
            },

            onMove: (evt) => {
                // Prevent moving to/from placeholder rows
                const fromIndex = evt.dragged.rowIndex;
                const toIndex = evt.related.rowIndex;

                const fromData = props.virtualProducts[fromIndex];
                const toData = props.virtualProducts[toIndex];

                // Block move if either item is a placeholder
                if (!fromData || fromData.isPlaceholder || !toData || toData.isPlaceholder) {
                    return false;
                }

                return true;
            }
        });

        console.log('✅ SortableJS initialized successfully');
    });
};

const destroySortable = () => {
    if (sortableInstance.value) {
        sortableInstance.value.destroy();
        sortableInstance.value = null;
        console.log('🗑️ SortableJS destroyed');
    }
};

// Helper methods for media detection
const hasVideo = (mediaList) => {
    if (!mediaList || !Array.isArray(mediaList)) return false;
    return mediaList.some((item) => isVideoFile(item));
};

const getMediaCountLabel = (mediaList) => {
    if (!mediaList || !Array.isArray(mediaList)) return '';

    const imageCount = mediaList.filter((item) => !isVideoFile(item)).length;
    const videoCount = mediaList.filter((item) => isVideoFile(item)).length;

    const parts = [];
    if (imageCount > 0) parts.push(`${imageCount} ảnh`);
    if (videoCount > 0) parts.push(`${videoCount} video`);

    return parts.join(' + ');
};

const isVideoFile = (item) => {
    if (!item) return false;

    // Check by URL extension
    const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|mkv|flv|m4v|3gp)$/i;
    if (item.url && videoExtensions.test(item.url)) return true;

    // Check by MIME type
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/mkv', 'video/m4v', 'video/3gp', 'video/quicktime', 'video/3gpp'];
    if (item.type && videoTypes.includes(item.type)) return true;
    if (item.mimeType && videoTypes.includes(item.mimeType)) return true;

    return false;
};

const toggleDragMode = () => {
    isDragMode.value = !isDragMode.value;

    if (isDragMode.value) {
        console.log('🎯 Enabling drag mode');
        // Wait a bit for the DOM to update with the drag handle column
        setTimeout(() => {
            initializeSortable();
        }, 100);
    } else {
        console.log('🎯 Disabling drag mode');
        destroySortable();
    }
};

// Watch for changes that require Sortable reinitialization
watch(
    [() => props.virtualProducts.length, isDragMode],
    ([newLength, newDragMode]) => {
        if (newDragMode && newLength > 0) {
            // Reinitialize when products load or drag mode is enabled
            setTimeout(() => {
                initializeSortable();
            }, 200);
        }
    },
    { deep: false }
);

// Watch for virtual products changes when in drag mode
watch(
    () => props.virtualProducts,
    () => {
        if (isDragMode.value) {
            // Reinitialize sortable when virtual products change
            setTimeout(() => {
                initializeSortable();
            }, 100);
        }
    },
    { deep: false }
);

// Lifecycle
onMounted(() => {
    console.log('📦 ProductDataTable mounted');
});

onUnmounted(() => {
    destroySortable();
    document.body.classList.remove('is-dragging');
    document.body.style.userSelect = '';
});

// Expose refs
defineExpose({
    dt: () => dt.value,
    toggleDragMode,
    isDragMode: () => isDragMode.value
});
</script>

<style scoped>
/* Drag Mode Styling */
:deep(.sortable-datatable) {
    position: relative;
    width: 100%;
}

:deep(.sortable-datatable .p-datatable-wrapper) {
    overflow-x: auto;
    width: 100%;
}

:deep(.sortable-datatable .p-datatable-table) {
    min-width: 100%;
    table-layout: auto;
}

:deep(.sortable-datatable.drag-mode .p-sortable-column .p-column-header-content) {
    cursor: default !important;
}

/* Fix table layout and scrolling */
:deep(.p-datatable) {
    width: 100%;
    overflow: visible;
}

:deep(.p-datatable-wrapper) {
    overflow-x: auto !important;
    overflow-y: visible !important;
    width: 100% !important;
}

:deep(.p-datatable-table) {
    width: 100% !important;
    min-width: fit-content !important;
}

/* Sortable Handle Styling */
.sortable-handle {
    transition: all 0.2s ease;
    border-radius: 4px;
    cursor: grab;
    user-select: none;
}

.sortable-handle:hover {
    background-color: var(--surface-200) !important;
    transform: scale(1.1);
}

.sortable-handle:active {
    cursor: grabbing !important;
}

/* Sortable States */
:deep(.sortable-chosen) {
    opacity: 0.8;
    transform: scale(1.02);
    background-color: var(--surface-100) !important;
}

:deep(.sortable-drag) {
    opacity: 0.9;
    transform: rotate(2deg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
    background: white !important;
    border: 2px solid var(--primary-color) !important;
    z-index: 1000 !important;
}

:deep(.sortable-ghost) {
    opacity: 0.3;
    background: var(--primary-50) !important;
    border: 2px dashed var(--primary-color) !important;
}

:deep(.sortable-fallback) {
    opacity: 0.8;
    background: white !important;
    border: 2px solid var(--primary-color) !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15) !important;
}

/* Global drag state */
:global(.is-dragging) {
    cursor: grabbing !important;
    user-select: none !important;
}

:global(.is-dragging *) {
    pointer-events: none !important;
}

:global(.is-dragging .sortable-handle) {
    pointer-events: all !important;
}

/* Row hover effects when in drag mode */
:deep(.sortable-datatable.drag-mode .p-datatable-tbody tr:hover) {
    background-color: var(--surface-100) !important;
}

/* Disable selection while dragging */
:deep(.sortable-datatable .p-datatable-tbody tr.sortable-chosen .p-checkbox) {
    pointer-events: none;
    opacity: 0.5;
}

/* Animation for smooth transitions */
:deep(.p-datatable-tbody tr) {
    transition: all 0.2s ease;
}

/* Prevent text selection during drag */
:deep(.sortable-datatable.drag-mode) {
    user-select: none;
}

/* Mobile optimizations */
@media (max-width: 768px) {
    .sortable-handle {
        padding: 0.75rem;
        min-width: 3rem;
    }

    .sortable-handle i {
        font-size: 1.1rem;
    }
}

/* Accessibility improvements */
.sortable-handle:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
}

/* Loading state adjustments */
:deep(.p-datatable-loading .sortable-handle) {
    pointer-events: none;
    opacity: 0.5;
}

/* Disable virtual scrolling animations during drag */
:deep(.is-dragging .p-datatable-tbody) {
    transform: none !important;
}
</style>