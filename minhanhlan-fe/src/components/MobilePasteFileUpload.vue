<template>
    <div class="mobile-paste-file-upload mt-2" ref="pasteZoneRef" @paste="onDirectPaste">
        <!-- Hidden file input for camera -->
        <input ref="cameraInputRef" type="file" accept="image/*" capture="environment" class="hidden" @change="onCameraCapture" multiple />

        <!-- Hidden input for paste support -->
        <input ref="hiddenInputRef" type="text" class="absolute opacity-0 pointer-events-none w-1 h-1 -left-full" @paste="onDirectPaste" />

        <FileUpload ref="fileUploadRef" v-bind="$attrs" :multiple="multiple" :accept="accept" :maxFileSize="maxFileSize" @select="onSelectedFiles">
            <template #header="{ chooseCallback, uploadCallback, clearCallback, files }">
                <div class="flex items-center justify-between mb-2 w-full">
                    <label class="font-bold">{{ label }}</label>
                    <div class="flex gap-2">
                        <slot name="header-buttons" :chooseCallback="chooseCallback" :uploadCallback="uploadCallback" :clearCallback="clearCallback" :files="files">
                            <Button @click="chooseCallback()" icon="pi pi-images" rounded outlined severity="secondary" v-tooltip.top="'Chọn file'"></Button>
                        </slot>

                        <!-- Camera button for mobile -->
                        <Button v-if="isMobile" @click="openCamera" icon="pi pi-camera" rounded outlined severity="secondary" v-tooltip.top="'Chụp ảnh'" />

                        <!-- Paste button -->
                        <Button @click="triggerPaste" icon="pi pi-clipboard" rounded outlined severity="info" v-tooltip.top="'Dán ảnh'" />
                    </div>
                </div>
            </template>

            <template #content="slotProps">
                <slot name="content" v-bind="slotProps" :merged-files="mergedFileList">
                    <!-- File previews -->
                    <div class="flex flex-wrap gap-4 mb-4" v-if="mergedFileList.length > 0">
                        <div v-for="file in mergedFileList" :key="file.key" class="relative w-[100px] h-[80px] rounded-lg border border-surface overflow-hidden flex-shrink-0">
                            <button @click="handleRemoveFile(file)" class="absolute top-0 right-0 w-6 h-6 text-red-500 flex items-center justify-center z-10 hover:bg-red-100 rounded-bl-lg bg-white/80">
                                <i class="pi pi-times text-xs"></i>
                            </button>
                            <Image :src="file.url" :alt="file.name" preview class="w-full h-full object-cover" />
                        </div>
                    </div>

                    <div class="flex items-center justify-center flex-col py-8 text-center">
                        <i class="pi pi-cloud-upload !border-2 !rounded-full !p-5 !text-4xl !text-muted-color mb-4" />
                        <p class="mb-2 font-medium">
                            {{ isMobile ? 'Chọn ảnh, chụp ảnh hoặc copy ảnh từ Photos rồi nhấn nút Dán' : 'Kéo hoặc paste ảnh vào đây' }}
                        </p>
                        <p v-if="isMobile" class="text-sm text-gray-500 mt-2">💡 Mẹo: Copy ảnh từ ứng dụng Photos → Mở browser → Nhấn nút Dán</p>
                    </div>
                </slot>
            </template>

            <!-- Pass through other slots -->
            <template v-for="(_, slotName) in $slots" #[slotName]="slotProps" :key="slotName">
                <slot :name="slotName" v-bind="slotProps" v-if="!['content', 'header-buttons'].includes(slotName)"></slot>
            </template>
        </FileUpload>

        <!-- Success/Error Toast equivalent -->
        <div v-if="showFeedback" class="fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all max-w-sm" :class="feedbackClass">
            <div class="flex items-start gap-2">
                <i :class="feedbackIcon" class="mt-0.5"></i>
                <span class="whitespace-pre-line text-sm">{{ feedbackMessage }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

// Props
const props = defineProps({
    multiple: { type: Boolean, default: true },
    accept: { type: String, default: 'image/*' },
    maxFileSize: { type: Number, default: 5000000 },
    label: { type: String, default: 'Hình ảnh' },
    initialFiles: { type: Array, default: () => [] },
    baseUrl: { type: String, default: import.meta.env.VITE_API_URL }
});

// Emits
const emit = defineEmits(['files-updated', 'file-added', 'file-removed', 'paste-success', 'paste-error']);

// Refs
const fileUploadRef = ref(null);
const pasteZoneRef = ref(null);
const hiddenInputRef = ref(null);
const cameraInputRef = ref(null);

// State
const isMobile = ref(false);
const currentFiles = ref([]);

// Feedback system
const showFeedback = ref(false);
const feedbackMessage = ref('');
const feedbackType = ref('success');

const feedbackClass = computed(() => ({
    'bg-green-100 text-green-800 border border-green-200': feedbackType.value === 'success',
    'bg-red-100 text-red-800 border border-red-200': feedbackType.value === 'error',
    'bg-blue-100 text-blue-800 border border-blue-200': feedbackType.value === 'info'
}));

const feedbackIcon = computed(() => ({
    'pi pi-check-circle text-green-600': feedbackType.value === 'success',
    'pi pi-times-circle text-red-600': feedbackType.value === 'error',
    'pi pi-info-circle text-blue-600': feedbackType.value === 'info'
}));

// Computed
const mergedFileList = computed(() => {
    const initial = (props.initialFiles || []).map((file, idx) => ({
        ...file,
        url: file.url.startsWith('http') ? file.url : props.baseUrl + file.url,
        key: `initial-${file.id || file.url}-${idx}`,
        type: 'initial',
        index: idx
    }));

    const pending = (currentFiles.value || []).map((file, idx) => ({
        ...file,
        url: file.objectURL || URL.createObjectURL(file),
        key: `pending-${file.name}-${file.size}-${idx}`,
        type: 'pending',
        index: idx
    }));

    return [...initial, ...pending];
});

// Device detection
const detectDevice = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
};

// Paste handling
const onDirectPaste = async (event) => {
    console.log('Paste event triggered');
    event.preventDefault();
    event.stopPropagation();

    const items = event.clipboardData?.items;
    if (!items) {
        console.log('No clipboard items found');
        showErrorFeedback('Không tìm thấy nội dung trong clipboard');
        return;
    }

    let hasImage = false;
    const newFiles = [];

    for (const item of items) {
        console.log('Clipboard item type:', item.type);
        if (item.type.startsWith('image/')) {
            hasImage = true;
            const file = item.getAsFile();
            if (file) {
                console.log('Image file found:', file.name, file.size);
                newFiles.push(file);
            }
        }
    }

    if (hasImage && newFiles.length > 0) {
        for (const file of newFiles) {
            await handlePastedFile(file);
        }
        showSuccessFeedback(`Đã thêm ${newFiles.length} ảnh`);
    } else {
        // Check if there's text content that might be an image URL
        const text = event.clipboardData.getData('text');
        if (text && isImageUrl(text)) {
            try {
                await handleImageUrl(text);
                showSuccessFeedback('Đã thêm ảnh từ URL');
            } catch (error) {
                showErrorFeedback('Không thể tải ảnh từ URL');
            }
        } else {
            showErrorFeedback('Không tìm thấy ảnh trong clipboard');
        }
    }
};

// Trigger paste manually
const triggerPaste = async () => {
    try {
        // Đặc biệt cho Safari: thử method cũ trước
        if (isMobile.value && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
            console.log('Safari mobile detected, using alternative method');

            // Method 1: Focus hidden input và prompt user
            if (hiddenInputRef.value) {
                hiddenInputRef.value.focus();
                hiddenInputRef.value.select();

                // Thử trigger paste event thủ công
                try {
                    const success = document.execCommand('paste');
                    if (!success) {
                        showInfoFeedback('Vui lòng:\n1. Nhấn giữ vào ô input\n2. Chọn "Paste"\n3. Hoặc sử dụng nút Chọn ảnh');
                        return;
                    }
                } catch (e) {
                    showInfoFeedback('Vui lòng:\n1. Nhấn giữ vào ô input\n2. Chọn "Paste"\n3. Hoặc sử dụng nút Chọn ảnh');
                    return;
                }
            }
            return;
        }

        // Kiểm tra Clipboard API availability
        if (!navigator.clipboard || !navigator.clipboard.read) {
            if (isMobile.value) {
                showInfoFeedback('Trình duyệt không hỗ trợ dán tự động.\nVui lòng sử dụng nút "Chọn ảnh"');
            } else {
                // Focus hidden input cho desktop
                if (hiddenInputRef.value) {
                    hiddenInputRef.value.focus();
                    hiddenInputRef.value.select();
                }
                showInfoFeedback('Vui lòng nhấn Ctrl+V để dán');
            }
            return;
        }

        // Kiểm tra permission
        try {
            const permission = await navigator.permissions.query({ name: 'clipboard-read' });
            console.log('Clipboard permission:', permission.state);

            if (permission.state === 'denied') {
                showInfoFeedback('Quyền truy cập clipboard bị từ chối.\nVui lòng sử dụng nút "Chọn ảnh"');
                return;
            }
        } catch (permError) {
            console.log('Permission API not available');
        }

        // Thử đọc clipboard
        try {
            const clipboardItems = await navigator.clipboard.read();

            let foundImage = false;
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        foundImage = true;
                        const blob = await clipboardItem.getType(type);
                        const file = new File([blob], `pasted-image-${Date.now()}.${type.split('/')[1]}`, { type });
                        await handlePastedFile(file);
                        showSuccessFeedback('Đã dán ảnh thành công');
                        return;
                    }
                }
            }

            if (!foundImage) {
                showInfoFeedback('Không có ảnh trong clipboard.\nHãy copy ảnh từ Photos trước khi dán');
            }
        } catch (clipboardError) {
            console.log('Clipboard read error:', clipboardError);

            // Fallback: hướng dẫn theo platform
            if (isMobile.value) {
                showInfoFeedback('Không thể đọc clipboard tự động.\n\nCách khác:\n1. Sử dụng nút "Chọn ảnh"\n2. Hoặc refresh trang và thử lại');
            } else {
                if (hiddenInputRef.value) {
                    hiddenInputRef.value.focus();
                    hiddenInputRef.value.select();
                }
                showInfoFeedback('Vui lòng nhấn Ctrl+V để dán');
            }
        }
    } catch (error) {
        console.error('Paste trigger error:', error);
        showErrorFeedback('Lỗi khi dán. Vui lòng sử dụng nút "Chọn ảnh"');
    }
};

// Check if text is an image URL
const isImageUrl = (text) => {
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp)$/i;
    const urlPattern = /^https?:\/\/.+/;
    return urlPattern.test(text) && imageExtensions.test(text);
};

// Handle image URL
const handleImageUrl = async (url) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        if (blob.type.startsWith('image/')) {
            const fileName = url.split('/').pop() || `image-${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: blob.type });
            await handlePastedFile(file);
        } else {
            throw new Error('URL does not point to an image');
        }
    } catch (error) {
        throw error;
    }
};

// Camera functionality
const openCamera = () => {
    if (cameraInputRef.value) {
        cameraInputRef.value.click();
    }
};

const onCameraCapture = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        Array.from(files).forEach((file) => {
            handlePastedFile(file);
        });
        showSuccessFeedback(`Đã chụp ${files.length} ảnh`);

        // Reset input
        event.target.value = '';
    }
};

// File handling
const handlePastedFile = async (file) => {
    console.log('Processing pasted file:', file.name, file.type, file.size);

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showErrorFeedback('File không phải là ảnh');
        return;
    }

    // Validate file size
    if (props.maxFileSize && file.size > props.maxFileSize) {
        const maxMB = (props.maxFileSize / 1024 / 1024).toFixed(1);
        showErrorFeedback(`File quá lớn. Tối đa: ${maxMB}MB`);
        return;
    }

    // Create object URL for preview
    if (!file.objectURL) {
        file.objectURL = URL.createObjectURL(file);
    }

    // Add to current files array
    currentFiles.value = [...currentFiles.value, file];

    // Sync with FileUpload component
    syncWithFileUpload();

    // Emit events
    emit('file-added', file);
    emitFilesUpdated();

    console.log('File added successfully');
};

const onSelectedFiles = (event) => {
    console.log('Files selected from FileUpload:', event.files);
    if (event.files) {
        // Replace current files with selected files
        currentFiles.value = [...event.files];
        emitFilesUpdated();
    }
};

const syncWithFileUpload = () => {
    // Sync current files with FileUpload component
    if (fileUploadRef.value) {
        fileUploadRef.value.files = [...currentFiles.value];
    }
};

const handleRemoveFile = (file) => {
    console.log('Removing file:', file);

    if (file.type === 'initial') {
        emit('file-removed', { file, type: 'initial' });
    } else if (file.type === 'pending') {
        // Remove from current files
        currentFiles.value = currentFiles.value.filter((f, index) => {
            const fileKey = `pending-${f.name}-${f.size}-${index}`;
            return fileKey !== file.key;
        });

        // Revoke object URL if exists
        if (file.url && file.url.startsWith('blob:')) {
            URL.revokeObjectURL(file.url);
        }

        // Sync with FileUpload component
        syncWithFileUpload();

        emit('file-removed', { file, type: 'pending' });
        emitFilesUpdated();
    }
};

const emitFilesUpdated = () => {
    emit('files-updated', {
        all: mergedFileList.value,
        pending: currentFiles.value,
        initial: props.initialFiles
    });
};

// Feedback system
const showSuccessFeedback = (message) => {
    feedbackType.value = 'success';
    feedbackMessage.value = message;
    showFeedback.value = true;

    setTimeout(() => {
        showFeedback.value = false;
    }, 3000);

    emit('paste-success', { message });
};

const showErrorFeedback = (message) => {
    feedbackType.value = 'error';
    feedbackMessage.value = message;
    showFeedback.value = true;

    setTimeout(() => {
        showFeedback.value = false;
    }, 4000);

    emit('paste-error', { message });
};

const showInfoFeedback = (message) => {
    feedbackType.value = 'info';
    feedbackMessage.value = message;
    showFeedback.value = true;

    setTimeout(() => {
        showFeedback.value = false;
    }, 5000); // Longer duration for instructions
};

// Global paste listener
const onGlobalPaste = (event) => {
    // Only handle if target is document body or our component
    if (event.target === document.body || pasteZoneRef.value?.contains(event.target)) {
        onDirectPaste(event);
    }
};

// Public methods
const clearFiles = () => {
    // Revoke all object URLs
    currentFiles.value.forEach((file) => {
        if (file.objectURL && file.objectURL.startsWith('blob:')) {
            URL.revokeObjectURL(file.objectURL);
        }
    });

    currentFiles.value = [];

    if (fileUploadRef.value) {
        fileUploadRef.value.clear();
    }

    emitFilesUpdated();
};

const getFiles = () => {
    return {
        all: mergedFileList.value,
        pending: currentFiles.value,
        initial: props.initialFiles
    };
};

// Watch for initialFiles changes
watch(
    () => props.initialFiles,
    (newFiles) => {
        if (newFiles !== undefined) {
            // Reset current files when initial files change
            currentFiles.value = [];

            nextTick(() => {
                emitFilesUpdated();
            });
        }
    },
    { immediate: true, deep: true }
);

// Lifecycle
onMounted(() => {
    detectDevice();

    // Add global paste listener
    document.addEventListener('paste', onGlobalPaste);

    // Add keyboard shortcuts
    const handleKeyDown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            // Don't interfere if user is typing in an input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            event.preventDefault();
            triggerPaste();
        }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Store cleanup function
    onUnmounted(() => {
        document.removeEventListener('paste', onGlobalPaste);
        document.removeEventListener('keydown', handleKeyDown);

        // Cleanup object URLs
        currentFiles.value.forEach((file) => {
            if (file.objectURL && file.objectURL.startsWith('blob:')) {
                URL.revokeObjectURL(file.objectURL);
            }
        });
    });
});

// Expose methods
defineExpose({
    clearFiles,
    getFiles,
    openCamera,
    triggerPaste
});
</script>

<style scoped>
/* File preview improvements */
.file-preview-container {
    transition: transform 0.2s ease;
}

.file-preview-container:hover {
    transform: scale(1.02);
}

.remove-file-btn {
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
}

.remove-file-btn:hover {
    background-color: rgba(239, 68, 68, 0.9);
    color: white;
}

/* Hidden file input */
.hidden {
    display: none !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .mobile-paste-zone {
        min-height: 80px;
        touch-action: manipulation;
    }
}
</style>