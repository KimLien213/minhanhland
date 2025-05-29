<template>
    <!-- Fullscreen Image Viewer -->
    <div v-if="visible" class="fixed inset-0 z-[9999] bg-black bg-opacity-95 flex items-center justify-center" @click="closeGallery" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
        <!-- Close Button -->
        <button @click="closeGallery" class="absolute top-4 right-4 z-20 bg-black bg-opacity-50 hover:bg-opacity-80 text-white border-none rounded-full w-12 h-12 flex items-center justify-center cursor-pointer transition-all duration-300">
            <i class="pi pi-times text-xl"></i>
        </button>

        <!-- Image Counter -->
        <div class="absolute top-4 left-4 z-20 bg-black bg-opacity-50 text-white px-4 py-2 rounded text-lg">{{ currentImageIndex + 1 }} / {{ images.length }}</div>

        <!-- Main Image Container -->
        <div class="relative w-full h-full flex items-center justify-center" @click.stop>
            <!-- Main Image -->
            <img v-if="images.length > 0" :src="getCurrentImage?.src" :alt="getCurrentImage?.alt || `Hình ảnh ${currentImageIndex + 1}`" class="max-w-[95vw] max-h-[95vh] object-contain" @click.stop />

            <!-- Navigation Buttons -->
            <button
                v-if="images.length > 1"
                @click.stop="prevImage"
                class="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 hover:bg-opacity-80 text-white border-none rounded-full w-16 h-16 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110"
            >
                <i class="pi pi-chevron-left text-2xl"></i>
            </button>

            <button
                v-if="images.length > 1"
                @click.stop="nextImage"
                class="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 hover:bg-opacity-80 text-white border-none rounded-full w-16 h-16 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110"
            >
                <i class="pi pi-chevron-right text-2xl"></i>
            </button>
        </div>

        <!-- Bottom Thumbnails -->
        <div v-if="images.length > 1 && showThumbnails" class="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-2 max-w-[90vw] overflow-x-auto p-2 bg-black bg-opacity-30 rounded-lg" @click.stop>
            <div
                v-for="(img, index) in images"
                :key="index"
                @click="goToImage(index)"
                :class="['flex-shrink-0 w-20 h-20 border-2 rounded cursor-pointer overflow-hidden transition-all', currentImageIndex === index ? 'border-white opacity-100 scale-110' : 'border-gray-400 opacity-60 hover:opacity-80']"
            >
                <img :src="img.src" :alt="img.alt || `Thumbnail ${index + 1}`" class="w-full h-full object-cover" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

// Props
const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    images: {
        type: Array,
        default: () => []
    },
    initialIndex: {
        type: Number,
        default: 0
    },
    showThumbnails: {
        type: Boolean,
        default: true
    }
});

// Emits
const emit = defineEmits(['update:visible', 'close']);

// State
const currentImageIndex = ref(0);
const touchStart = ref({ x: 0, y: 0 });
const touchEnd = ref({ x: 0, y: 0 });

// Computed
const getCurrentImage = computed(() => {
    return props.images[currentImageIndex.value];
});

// Methods
const closeGallery = () => {
    emit('update:visible', false);
    emit('close');
    document.body.style.overflow = 'auto';
};

const nextImage = () => {
    if (currentImageIndex.value < props.images.length - 1) {
        currentImageIndex.value++;
    } else {
        currentImageIndex.value = 0; // Circular
    }
};

const prevImage = () => {
    if (currentImageIndex.value > 0) {
        currentImageIndex.value--;
    } else {
        currentImageIndex.value = props.images.length - 1; // Circular
    }
};

const goToImage = (index) => {
    if (index >= 0 && index < props.images.length) {
        currentImageIndex.value = index;
    }
};

// Keyboard navigation
const handleKeydown = (event) => {
    if (!props.visible) return;

    switch (event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            prevImage();
            break;
        case 'ArrowRight':
            event.preventDefault();
            nextImage();
            break;
        case 'Escape':
            event.preventDefault();
            closeGallery();
            break;
    }
};

// Touch support
const handleTouchStart = (event) => {
    touchStart.value = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };
};

const handleTouchMove = (event) => {
    touchEnd.value = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };
};

const handleTouchEnd = (event) => {
    if (!touchStart.value.x || !touchEnd.value.x) return;

    const deltaX = touchStart.value.x - touchEnd.value.x;
    const deltaY = touchStart.value.y - touchEnd.value.y;

    // Prevent default swipe behavior
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        event.preventDefault();
        if (deltaX > 0) {
            nextImage(); // Swipe left
        } else {
            prevImage(); // Swipe right
        }
    }

    touchStart.value = { x: 0, y: 0 };
    touchEnd.value = { x: 0, y: 0 };
};

// Watchers
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            currentImageIndex.value = props.initialIndex;
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }
);

watch(
    () => props.initialIndex,
    (newVal) => {
        if (newVal >= 0 && newVal < props.images.length) {
            currentImageIndex.value = newVal;
        }
    }
);

// Lifecycle
onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = 'auto';
});
</script>