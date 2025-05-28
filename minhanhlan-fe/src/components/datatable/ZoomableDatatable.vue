<template>
    <div class="card">
        <div class="flex justify-content-between align-items-center mb-3">
            <h5 class="m-0">Zoomable DataTable</h5>

            <!-- Controls -->
            <div class="flex align-items-center gap-2">
                <!-- Zoom Controls -->
                <div class="flex align-items-center gap-1">
                    <Button icon="pi pi-minus" class="p-button-sm p-button-outlined" @click="zoomOut" :disabled="zoomLevel <= 0.5" />
                    <span class="text-sm font-medium px-2"> {{ Math.round(zoomLevel * 100) }}% </span>
                    <Button icon="pi pi-plus" class="p-button-sm p-button-outlined" @click="zoomIn" :disabled="zoomLevel >= 2" />
                </div>

                <!-- Fullscreen Toggle -->
                <Button :icon="isFullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" class="p-button-sm p-button-outlined" @click="toggleFullscreen" v-tooltip.top="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'" />
            </div>
        </div>

        <!-- Table Container -->
        <div ref="tableContainer" :class="['table-container', { fullscreen: isFullscreen }]">
            <!-- Exit Fullscreen Button (only visible in fullscreen) -->
            <div v-if="isFullscreen" class="fullscreen-exit-button">
                <Button icon="pi pi-times" class="p-button-rounded p-button-danger p-button-sm" @click="exitFullscreen" v-tooltip.left="'Exit Fullscreen (ESC)'" />
            </div>
            <DataTable :value="products" :paginator="true" :rows="10" :scrollable="true" scrollHeight="400px" :resizableColumns="true" columnResizeMode="expand" showGridlines class="p-datatable-sm">
                <Column field="code" header="Code" :style="getColumnStyle(100)">
                    <template #body="slotProps">
                        <span class="font-semibold" :style="getTextStyle()">{{ slotProps.data.code }}</span>
                    </template>
                </Column>

                <Column field="name" header="Name" :style="getColumnStyle(200)">
                    <template #body="slotProps">
                        <span :style="getTextStyle()">{{ slotProps.data.name }}</span>
                    </template>
                </Column>

                <Column field="category" header="Category" :style="getColumnStyle(120)">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.category" :severity="getCategorySeverity(slotProps.data.category)" :style="getTextStyle()" />
                    </template>
                </Column>

                <Column field="quantity" header="Quantity" :style="getColumnStyle(80)">
                    <template #body="slotProps">
                        <span :class="slotProps.data.quantity < 10 ? 'text-red-500' : 'text-green-500'" :style="getTextStyle()">
                            {{ slotProps.data.quantity }}
                        </span>
                    </template>
                </Column>

                <Column field="price" header="Price" :style="getColumnStyle(100)">
                    <template #body="slotProps">
                        <span class="font-semibold" :style="getTextStyle()">${{ slotProps.data.price }}</span>
                    </template>
                </Column>

                <Column field="rating" header="Rating" :style="getColumnStyle(120)">
                    <template #body="slotProps">
                        <Rating :modelValue="slotProps.data.rating" :readonly="true" :cancel="false" />
                    </template>
                </Column>

                <Column field="inventoryStatus" header="Status" :style="getColumnStyle(100)">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.inventoryStatus" :severity="getStatusSeverity(slotProps.data.inventoryStatus)" :style="getTextStyle()" />
                    </template>
                </Column>

                <Column field="description" header="Description" :style="getColumnStyle(250)">
                    <template #body="slotProps">
                        <span class="text-sm" :style="getTextStyle()">{{ slotProps.data.description }}</span>
                    </template>
                </Column>

                <Column header="Actions" :style="getColumnStyle(120)" :exportable="false">
                    <template #body="slotProps">
                        <div class="flex gap-1">
                            <Button icon="pi pi-pencil" class="p-button-rounded p-button-text p-button-sm" />
                            <Button icon="pi pi-trash" class="p-button-rounded p-button-text p-button-sm p-button-danger" />
                            <Button icon="pi pi-eye" class="p-button-rounded p-button-text p-button-sm p-button-info" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>

<script>
import { onMounted, onUnmounted, ref } from 'vue';

export default {
    name: 'ZoomableDataTable',
    setup() {
        const zoomLevel = ref(1);
        const isFullscreen = ref(false);
        const tableContainer = ref(null);

        const products = ref([
            {
                id: 1,
                code: 'PRD001',
                name: 'Wireless Headphones',
                category: 'Electronics',
                quantity: 25,
                price: 99.99,
                rating: 4,
                inventoryStatus: 'INSTOCK',
                description: 'High-quality wireless headphones with noise cancellation'
            },
            {
                id: 2,
                code: 'PRD002',
                name: 'Gaming Mouse',
                category: 'Electronics',
                quantity: 8,
                price: 49.99,
                rating: 5,
                inventoryStatus: 'LOWSTOCK',
                description: 'Ergonomic gaming mouse with RGB lighting'
            },
            {
                id: 3,
                code: 'PRD003',
                name: 'Coffee Maker',
                category: 'Appliances',
                quantity: 0,
                price: 129.99,
                rating: 3,
                inventoryStatus: 'OUTOFSTOCK',
                description: 'Automatic coffee maker with programmable timer'
            },
            {
                id: 4,
                code: 'PRD004',
                name: 'Laptop Stand',
                category: 'Accessories',
                quantity: 50,
                price: 29.99,
                rating: 4,
                inventoryStatus: 'INSTOCK',
                description: 'Adjustable aluminum laptop stand for better ergonomics'
            },
            {
                id: 5,
                code: 'PRD005',
                name: 'Smartphone Case',
                category: 'Accessories',
                quantity: 15,
                price: 19.99,
                rating: 4,
                inventoryStatus: 'INSTOCK',
                description: 'Protective case with shock absorption technology'
            },
            {
                id: 6,
                code: 'PRD006',
                name: 'Bluetooth Speaker',
                category: 'Electronics',
                quantity: 3,
                price: 79.99,
                rating: 5,
                inventoryStatus: 'LOWSTOCK',
                description: 'Portable Bluetooth speaker with excellent sound quality'
            },
            {
                id: 7,
                code: 'PRD007',
                name: 'Office Chair',
                category: 'Furniture',
                quantity: 12,
                price: 199.99,
                rating: 4,
                inventoryStatus: 'INSTOCK',
                description: 'Ergonomic office chair with lumbar support'
            },
            {
                id: 8,
                code: 'PRD008',
                name: 'Desk Lamp',
                category: 'Furniture',
                quantity: 0,
                price: 39.99,
                rating: 3,
                inventoryStatus: 'OUTOFSTOCK',
                description: 'LED desk lamp with adjustable brightness'
            }
        ]);

        const zoomIn = () => {
            if (zoomLevel.value < 2) {
                zoomLevel.value = Math.min(2, zoomLevel.value + 0.1);
            }
        };

        const zoomOut = () => {
            if (zoomLevel.value > 0.5) {
                zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.1);
            }
        };

        const toggleFullscreen = () => {
            if (!isFullscreen.value) {
                enterFullscreen();
            } else {
                exitFullscreen();
            }
        };

        const enterFullscreen = () => {
            if (tableContainer.value.requestFullscreen) {
                tableContainer.value.requestFullscreen();
            } else if (tableContainer.value.webkitRequestFullscreen) {
                tableContainer.value.webkitRequestFullscreen();
            } else if (tableContainer.value.msRequestFullscreen) {
                tableContainer.value.msRequestFullscreen();
            }
        };

        const exitFullscreen = () => {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        };

        const handleFullscreenChange = () => {
            isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
        };

        const getColumnStyle = (baseWidth) => {
            const adjustedWidth = baseWidth * zoomLevel.value;
            return {
                minWidth: `${adjustedWidth}px`,
                width: `${adjustedWidth}px`
            };
        };

        const getTableStyle = () => {
            return {
                fontSize: `${0.875 * zoomLevel.value}rem`
            };
        };

        const getTextStyle = () => {
            return {
                fontSize: `${0.875 * zoomLevel.value}rem`
            };
        };

        const getCategorySeverity = (category) => {
            switch (category) {
                case 'Electronics':
                    return 'info';
                case 'Appliances':
                    return 'warning';
                case 'Accessories':
                    return 'success';
                case 'Furniture':
                    return 'secondary';
                default:
                    return null;
            }
        };

        const getStatusSeverity = (status) => {
            switch (status) {
                case 'INSTOCK':
                    return 'success';
                case 'LOWSTOCK':
                    return 'warning';
                case 'OUTOFSTOCK':
                    return 'danger';
                default:
                    return null;
            }
        };

        // Keyboard shortcuts
        const handleKeydown = (event) => {
            if (event.ctrlKey || event.metaKey) {
                if (event.key === '=' || event.key === '+') {
                    event.preventDefault();
                    zoomIn();
                } else if (event.key === '-') {
                    event.preventDefault();
                    zoomOut();
                } else if (event.key === '0') {
                    event.preventDefault();
                    zoomLevel.value = 1;
                }
            }

            if (event.key === 'F11') {
                event.preventDefault();
                toggleFullscreen();
            }

            // ESC to exit fullscreen
            if (event.key === 'Escape' && isFullscreen.value) {
                exitFullscreen();
            }
        };

        onMounted(() => {
            document.addEventListener('fullscreenchange', handleFullscreenChange);
            document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.addEventListener('msfullscreenchange', handleFullscreenChange);
            document.addEventListener('keydown', handleKeydown);
        });

        onUnmounted(() => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeydown);
        });

        return {
            products,
            zoomLevel,
            isFullscreen,
            tableContainer,
            zoomIn,
            zoomOut,
            toggleFullscreen,
            exitFullscreen,
            getColumnStyle,
            getTableStyle,
            getTextStyle,
            getCategorySeverity,
            getStatusSeverity
        };
    }
};
</script>

<style scoped>
.table-container {
    transition: all 0.2s ease-in-out;
    overflow: auto;
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
}

.table-container.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 9999;
    background: var(--surface-ground);
    padding: 1rem;
    border: none;
    border-radius: 0;
}

.table-container.fullscreen .p-datatable {
    height: calc(100vh - 2rem);
}

/* Exit fullscreen button positioning */
.fullscreen-exit-button {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .table-container {
        font-size: 0.875rem;
    }

    .flex.gap-2 > div {
        flex-wrap: wrap;
    }
}

/* Custom scrollbar */
.table-container::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.table-container::-webkit-scrollbar-track {
    background: var(--surface-ground);
}

.table-container::-webkit-scrollbar-thumb {
    background: var(--surface-border);
    border-radius: 4px;
}

.table-container::-webkit-scrollbar-thumb:hover {
    background: var(--surface-300);
}
</style>