<template>
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
        :scrollHeight="scrollHeight"
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
        :sortField="currentSort.sortBy"
        :sortOrder="currentSort.sortOrder === 'ASC' ? 1 : -1"
        @columnReorder="onColumnReorder"
        @sort="$emit('sort', $event)"
        @filter="$emit('filter')"
        :class="tableClass"
    >
        <template #empty>
            <span>Không có căn hộ nào.</span>
        </template>

        <template #header>
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
                <div class="flex items-start gap-2">
                    <span class="text-sm font-bold">Tổng số: {{ totalRecords }} căn hộ</span>
                </div>
                <div class="flex items-end gap-2">
                    <IconField class="w-full">
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText v-model="filters.global.value" class="w-full" placeholder="Tìm kiếm..." />
                    </IconField>
                    <Button type="button" @click="$emit('refresh')" icon="pi pi-refresh" text />
                    <Button v-if="!isFullscreen" type="button" icon="pi pi-window-maximize" @click="$emit('fullscreen')" text />
                </div>
            </div>
        </template>

        <!-- Selection Column -->
        <Column selectionMode="multiple" :frozen="!isMobile" style="width: 2rem; height: 60px" :exportable="false">
            <template #loading>
                <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                    <Skeleton width="100%" height="1rem" />
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
            :sortable="item.sortable !== false && isAdmin"
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
                    <div v-else-if="item.type === 'images'" class="flex items-center justify-center gap-2">
                        <Button v-if="data[item.key]?.length > 0" @click="$emit('show-images', data[item.key])" icon="pi pi-images" outlined rounded severity="info" />
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
                    <Skeleton :width="getSkeletonWidth(item)" height="1rem" />
                </div>
            </template>

            <template #header>
                <div class="relative w-full h-full flex items-center justify-between">
                    <span class="font-bold">{{ item.label }}</span>

                    <!-- Luôn có container cho icon, dù có filter hay không -->
                    <div class="w-4 h-4 flex items-center justify-center">
                        <i v-if="item.filterable" class="pi pi-filter cursor-pointer text-xs" :class="filters[item.key]?.value?.length ? 'text-blue-500' : 'text-gray-400 hover:text-gray-700'" @click.stop="toggleFilter(item.key)"></i>
                    </div>

                    <MultiSelect
                        v-if="item.filterable"
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
        <Column :exportable="false" style="min-width: 12rem; height: 60px">
            <template #body="{ data }">
                <!-- Skeleton cho placeholder -->
                <div v-if="!data || data.isPlaceholder" class="flex items-center gap-2" style="height: 17px">
                    <Skeleton width="2rem" height="2rem" class="rounded-full" />
                    <Skeleton width="2rem" height="2rem" class="rounded-full" />
                </div>
                <!-- Action buttons -->
                <div v-else class="flex items-center gap-2">
                    <Button icon="pi pi-pencil" outlined rounded size="small" @click="$emit('edit-product', data)" />
                    <Button icon="pi pi-trash" outlined rounded size="small" severity="danger" @click="$emit('delete-product', data)" />
                </div>
            </template>
        </Column>
    </DataTable>
</template>

<script setup>
import { format } from 'date-fns';
import { computed, nextTick, reactive } from 'vue';

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
    scrollHeight: { type: String, default: '600px' },
    tableClass: { type: String, default: '' },
    isFullscreen: { type: Boolean, default: false }
});

// Emits
const emit = defineEmits(['update:selectedProducts', 'sort', 'filter', 'refresh', 'fullscreen', 'show-images', 'edit-product', 'delete-product', 'lazy-load']);

// Reactive refs for MultiSelect
const multiSelectRefs = reactive({});

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

// Expose refs
defineExpose({
    dt: () => dt.value
});
</script>