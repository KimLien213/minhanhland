<template>
    <!-- Fullscreen Media Viewer -->
    <div v-if="visible" class="fixed inset-0 z-[9999] bg-black bg-opacity-95 flex items-center justify-center" @click="closeGallery" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
        <!-- Close Button -->
        <button @click="closeGallery" class="absolute top-4 right-4 z-20 bg-black bg-opacity-50 hover:bg-opacity-80 text-white border-none rounded-full w-12 h-12 flex items-center justify-center cursor-pointer transition-all duration-300">
            <i class="pi pi-times text-xl"></i>
        </button>

        <!-- Media Counter -->
        <div class="absolute top-4 left-4 z-20 bg-black bg-opacity-50 text-white px-4 py-2 rounded text-lg">
            <span>{{ currentMediaIndex + 1 }} / {{ media.length }}</span>
            <Button class="ml-2" type="button" icon="pi pi-download" severity="secondary" variant="text" rounded @click.stop="downloadCurrentMedia" />
        </div>

        <!-- Media Type Indicator -->
        <div v-if="isCurrentVideo" class="absolute top-16 left-4 z-20 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm"><i class="pi pi-video mr-1"></i>Video</div>

        <!-- Main Media Container -->
        <div class="relative w-full h-full flex items-center justify-center" @click.stop>
            <!-- Image Display -->
            <img v-if="getCurrentMedia && !isCurrentVideo" :src="getCurrentMedia?.src" :alt="getCurrentMedia?.alt || `Hình ảnh ${currentMediaIndex + 1}`" class="max-w-[95vw] max-h-[95vh] object-contain" @click.stop />

            <!-- Video Display -->
            <video v-if="getCurrentMedia && isCurrentVideo" :src="getCurrentMedia?.src" controls autoplay class="max-w-[95vw] max-h-[95vh]" @click.stop ref="currentVideoRef">
                <source :src="getCurrentMedia?.src" type="video/mp4" />
                <source :src="getCurrentMedia?.src" type="video/webm" />
                <source :src="getCurrentMedia?.src" type="video/ogg" />
                <source :src="getCurrentMedia?.src" type="video/avi" />
                <source :src="getCurrentMedia?.src" type="video/mov" />
                <source :src="getCurrentMedia?.src" type="video/wmv" />
                <source :src="getCurrentMedia?.src" type="video/mkv" />
                <source :src="getCurrentMedia?.src" type="video/flv" />
                <source :src="getCurrentMedia?.src" type="video/m4v" />
                <source :src="getCurrentMedia?.src" type="video/3gp" />
                <source :src="getCurrentMedia?.src" type="video/quicktime" />
                Trình duyệt không hỗ trợ video này.
            </video>

            <!-- Navigation Buttons -->
            <button
                v-if="media.length > 1"
                @click.stop="prevMedia"
                class="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 hover:bg-opacity-80 text-white border-none rounded-full w-16 h-16 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110"
            >
                <i class="pi pi-chevron-left text-2xl"></i>
            </button>

            <button
                v-if="media.length > 1"
                @click.stop="nextMedia"
                class="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 hover:bg-opacity-80 text-white border-none rounded-full w-16 h-16 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110"
            >
                <i class="pi pi-chevron-right text-2xl"></i>
            </button>
        </div>

        <!-- Bottom Thumbnails -->
        <div v-if="media.length > 1 && showThumbnails" class="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-2 max-w-[90vw] overflow-x-auto p-2 bg-black bg-opacity-30 rounded-lg" @click.stop>
            <div
                v-for="(item, index) in media"
                :key="index"
                @click="goToMedia(index)"
                :class="['flex-shrink-0 w-20 h-20 border-2 rounded cursor-pointer overflow-hidden transition-all relative', currentMediaIndex === index ? 'border-white opacity-100 scale-110' : 'border-gray-400 opacity-60 hover:opacity-80']"
            >
                <!-- Image Thumbnail -->
                <img v-if="!isVideo(item)" :src="item.src" :alt="item.alt || `Thumbnail ${index + 1}`" class="w-full h-full object-cover" />

                <!-- Video Thumbnail -->
                <div v-else class="w-full h-full relative bg-gray-800 flex items-center justify-center">
                    <video :src="item.src" class="w-full h-full object-cover" muted>
                        <source :src="item.src" type="video/mp4" />
                    </video>
                    <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                        <i class="pi pi-play text-white text-lg"></i>
                    </div>
                    <div class="absolute bottom-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1">
                        <i class="pi pi-video"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- Video Controls Info -->
        <div v-if="isCurrentVideo" class="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm"><i class="pi pi-info-circle mr-1"></i>Nhấn vào video để điều khiển</div>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

// Props
const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    media: {
        // Changed from 'images' to 'media'
        type: Array,
        default: () => []
    },
    images: {
        // Keep for backward compatibility
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
const currentMediaIndex = ref(0);
const touchStart = ref({ x: 0, y: 0 });
const touchEnd = ref({ x: 0, y: 0 });
const currentVideoRef = ref(null);
const internalShowThumbnails = ref(true);

// Computed - Support both 'media' and 'images' props for backward compatibility
const mediaList = computed(() => {
    return props.media.length > 0 ? props.media : props.images;
});

const showThumbnails = computed({
    get: () => internalShowThumbnails.value && props.showThumbnails,
    set: (value) => (internalShowThumbnails.value = value)
});

const getCurrentMedia = computed(() => {
    return mediaList.value[currentMediaIndex.value];
});

const isCurrentVideo = computed(() => {
    if (!getCurrentMedia.value) return false;
    return isVideo(getCurrentMedia.value);
});

// Helper function to detect video
const isVideo = (mediaItem) => {
    if (!mediaItem) return false;

    // Check by URL extension
    const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|mkv|flv|m4v|3gp)$/i;
    if (mediaItem.src && videoExtensions.test(mediaItem.src)) {
        return true;
    }

    // Check by type property
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/mkv', 'video/m4v', 'video/3gp', 'video/quicktime', 'video/3gpp'];
    if (mediaItem.type && videoTypes.includes(mediaItem.type)) {
        return true;
    }

    // Check by mimeType property
    if (mediaItem.mimeType && videoTypes.includes(mediaItem.mimeType)) {
        return true;
    }

    return false;
};

// Download functionality
const downloadCurrentMedia = async () => {
    const currentMedia = getCurrentMedia.value;
    if (!currentMedia) {
        console.error('No media to download');
        return;
    }

    try {
        const url = currentMedia.src;
        const filename = currentMedia.name || currentMedia.alt || generateFileName(currentMedia);

        // Try using the download link method first
        if (url.startsWith('blob:') || url.startsWith('data:')) {
            // For blob URLs or data URLs, use direct download
            await downloadFile(url, filename);
        } else {
            // For external URLs, fetch first then download
            await downloadFileFromUrl(url, filename);
        }

        console.log('Download initiated for:', filename);
    } catch (error) {
        console.error('Download failed:', error);

        // Fallback: open in new window
        try {
            window.open(currentMedia.src, '_blank');
        } catch (fallbackError) {
            console.error('Fallback download also failed:', fallbackError);
        }
    }
};

const generateFileName = (media) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = isVideo(media) ? 'mp4' : 'jpg';
    const type = isVideo(media) ? 'video' : 'image';
    return `${type}-${timestamp}.${extension}`;
};

const downloadFile = (url, filename) => {
    return new Promise((resolve, reject) => {
        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            resolve();
        } catch (error) {
            reject(error);
        }
    });
};

const downloadFileFromUrl = async (url, filename) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        await downloadFile(blobUrl, filename);

        // Clean up the blob URL
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
        throw new Error(`Failed to fetch file: ${error.message}`);
    }
};

// Toggle thumbnails
const toggleThumbnails = () => {
    internalShowThumbnails.value = !internalShowThumbnails.value;
};

// Methods
const closeGallery = () => {
    // Pause any playing video
    if (currentVideoRef.value) {
        currentVideoRef.value.pause();
    }

    emit('update:visible', false);
    emit('close');
    document.body.style.overflow = 'auto';
};

const nextMedia = () => {
    // Pause current video if playing
    if (currentVideoRef.value) {
        currentVideoRef.value.pause();
    }

    if (currentMediaIndex.value < mediaList.value.length - 1) {
        currentMediaIndex.value++;
    } else {
        currentMediaIndex.value = 0; // Circular
    }

    // Auto-play next video
    nextTick(() => {
        if (isCurrentVideo.value && currentVideoRef.value) {
            currentVideoRef.value.play().catch(console.error);
        }
    });
};

const prevMedia = () => {
    // Pause current video if playing
    if (currentVideoRef.value) {
        currentVideoRef.value.pause();
    }

    if (currentMediaIndex.value > 0) {
        currentMediaIndex.value--;
    } else {
        currentMediaIndex.value = mediaList.value.length - 1; // Circular
    }

    // Auto-play previous video
    nextTick(() => {
        if (isCurrentVideo.value && currentVideoRef.value) {
            currentVideoRef.value.play().catch(console.error);
        }
    });
};

const goToMedia = (index) => {
    if (index >= 0 && index < mediaList.value.length) {
        // Pause current video if playing
        if (currentVideoRef.value) {
            currentVideoRef.value.pause();
        }

        currentMediaIndex.value = index;

        // Auto-play if it's a video
        nextTick(() => {
            if (isCurrentVideo.value && currentVideoRef.value) {
                currentVideoRef.value.play().catch(console.error);
            }
        });
    }
};

// Keyboard navigation
const handleKeydown = (event) => {
    if (!props.visible) return;

    switch (event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            prevMedia();
            break;
        case 'ArrowRight':
            event.preventDefault();
            nextMedia();
            break;
        case 'Escape':
            event.preventDefault();
            closeGallery();
            break;
        case ' ': // Spacebar
            event.preventDefault();
            if (isCurrentVideo.value && currentVideoRef.value) {
                if (currentVideoRef.value.paused) {
                    currentVideoRef.value.play();
                } else {
                    currentVideoRef.value.pause();
                }
            }
            break;
        case 'd':
        case 'D':
            // Download shortcut
            event.preventDefault();
            downloadCurrentMedia();
            break;
        case 't':
        case 'T':
            // Toggle thumbnails
            event.preventDefault();
            toggleThumbnails();
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

// Watchers
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            currentMediaIndex.value = props.initialIndex;
            document.body.style.overflow = 'hidden';

            // Auto-play video if current media is video
            nextTick(() => {
                if (isCurrentVideo.value && currentVideoRef.value) {
                    currentVideoRef.value.play().catch(console.error);
                }
            });
        } else {
            document.body.style.overflow = 'auto';
        }
    }
);

watch(
    () => props.initialIndex,
    (newVal) => {
        if (newVal >= 0 && newVal < mediaList.value.length) {
            currentMediaIndex.value = newVal;
        }
    }
);

// Watch for media index changes to handle video playback
watch(currentMediaIndex, () => {
    nextTick(() => {
        if (isCurrentVideo.value && currentVideoRef.value) {
            // Set video time to beginning and play
            currentVideoRef.value.currentTime = 0;
            currentVideoRef.value.play().catch(console.error);
        }
    });
});

// Watch for showThumbnails prop changes
watch(
    () => props.showThumbnails,
    (newVal) => {
        if (!newVal) {
            internalShowThumbnails.value = false;
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
const handleTouchEnd = (event) => {
    if (!touchStart.value.x || !touchEnd.value.x) return;

    const deltaX = touchStart.value.x - touchEnd.value.x;
    const deltaY = touchStart.value.y - touchEnd.value.y;

    // Prevent default swipe behavior
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        event.preventDefault();
        if (deltaX > 0) {
            nextMedia(); // Swipe left
        } else {
            prevMedia(); // Swipe right
        }
    }

    touchStart.value = { x: 0, y: 0 };
    touchEnd.value = { x: 0, y: 0 };
};

// Expose methods for backward compatibility
defineExpose({
    nextMedia,
    prevMedia,
    goToMedia,
    closeGallery,
    downloadCurrentMedia,
    toggleThumbnails,
    // Legacy method names
    nextImage: nextMedia,
    prevImage: prevMedia,
    goToImage: goToMedia
});
</script>

<style scoped>
/* Video specific styling */
video {
    border-radius: 0;
}

/* Thumbnail video styling */
.thumbnail-video {
    pointer-events: none;
}

/* Loading states */
video:not([src]) {
    background: #333;
}

/* Gallery modal styling */
.gallery-modal {
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
}

/* Control hints */
.video-controls-hint {
    animation: fadeInOut 3s ease-in-out;
}

@keyframes fadeInOut {
    0%,
    100% {
        opacity: 0;
    }
    50% {
        opacity: 1;
    }
}

/* Smooth transitions */
.media-transition {
    transition: all 0.3s ease;
}

/* Download button animation */
.download-btn {
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.download-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.download-btn:active {
    transform: scale(0.95);
}

/* Center download button pulse */
.pulse-download {
    animation: pulseDownload 2s infinite;
}

@keyframes pulseDownload {
    0%,
    100% {
        box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
        transform: translateX(-50%) scale(1);
    }
    50% {
        box-shadow: 0 0 0 20px rgba(220, 38, 38, 0);
        transform: translateX(-50%) scale(1.1);
    }
}

/* Large download button */
.download-btn-large {
    animation: bounce 2s infinite;
}

@keyframes bounce {
    0%,
    20%,
    50%,
    80%,
    100% {
        transform: translateY(0);
    }
    40% {
        transform: translateY(-10px);
    }
    60% {
        transform: translateY(-5px);
    }
}

/* Thumbnail scrollbar styling */
.thumbnail-container::-webkit-scrollbar {
    height: 4px;
}

.thumbnail-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
}

.thumbnail-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
}

.thumbnail-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
}

/* Mobile optimizations */
@media (max-width: 768px) {
    video,
    img {
        max-height: calc(100vh - 120px) !important;
        max-width: 100vw !important;
    }

    .thumbnail-container {
        width: 60px;
        height: 60px;
    }

    /* Hide thumbnails on very small screens */
    @media (max-height: 500px) {
        .thumbnail-container {
            display: none;
        }
    }

    /* Landscape mode adjustments */
    @media (orientation: landscape) and (max-height: 500px) {
        .shrink-0 {
            padding: 0.5rem;
        }

        video,
        img {
            max-height: calc(100vh - 80px) !important;
        }
    }
}

/* Accessibility improvements */
button:focus {
    outline: 2px solid white;
    outline-offset: 2px;
}

/* Loading state for images/videos */
.loading-placeholder {
    background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
}

@keyframes loading {
    0% {
        background-position: 200% 0;
    }
    100% {
        background-position: -200% 0;
    }
}
</style>