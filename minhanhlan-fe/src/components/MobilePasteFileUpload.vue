<template>
    <div class="mobile-paste-file-upload" ref="pasteZoneRef">
        <!-- iOS Direct Paste Zone -->
        <div v-if="isMobile && showPasteZone" class="mb-4 p-4 border-2 border-dashed rounded-lg transition-all duration-300" :class="isPasteZoneActive ? 'border-blue-500 bg-blue-50 paste-zone-active' : 'border-gray-300 bg-gray-50'">
            <div class="flex flex-col items-center justify-center text-center">
                <i class="pi pi-clipboard text-2xl mb-2" :class="isPasteZoneActive ? 'text-blue-500' : 'text-gray-500'"></i>
                <p class="text-sm font-medium" :class="isPasteZoneActive ? 'text-blue-700' : 'text-gray-600'">
                    {{ pasteZoneMessage }}
                </p>
            </div>
        </div>

        <!-- iOS Optimized Paste Button -->
        <div v-if="isMobile" class="mb-4 flex gap-2">
            <!-- Direct paste area that user can interact with -->
            <div class="relative flex-1">
                <textarea
                    ref="pasteInputRef"
                    v-model="pasteText"
                    placeholder="Nhấn và giữ để dán ảnh..."
                    class="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
                    :class="isPasteZoneActive ? 'border-blue-500 bg-blue-50' : ''"
                    rows="2"
                    @paste="onDirectPaste"
                    @focus="onPasteFocus"
                    @blur="onPasteBlur"
                    @touchstart="onTouchStart"
                />
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div v-if="!pasteText" class="flex items-center gap-2 text-gray-500">
                        <i class="pi pi-clipboard"></i>
                        <span class="text-sm">{{ isIOS ? 'Nhấn giữ → Paste' : 'Long press → Paste' }}</span>
                    </div>
                </div>
            </div>

            <!-- Camera button -->
            <Button @click="openCamera" icon="pi pi-camera" outlined severity="secondary" v-tooltip.top="'Chụp ảnh'" class="h-fit" />
        </div>

        <!-- Alternative method for iOS -->
        <div v-if="isIOS" class="mb-4 p-3 bg-blue-50 rounded-lg">
            <div class="flex items-start gap-3">
                <i class="pi pi-info-circle text-blue-500 mt-0.5"></i>
                <div class="text-sm text-blue-700">
                    <p class="font-medium mb-1">📱 Cách dán ảnh trên iPhone:</p>
                    <ol class="list-decimal list-inside space-y-1 text-xs">
                        <li>Copy ảnh từ Photos hoặc chụp ảnh mới</li>
                        <li>Nhấn vào ô text trên</li>
                        <li>Nhấn và giữ → chọn "Paste"</li>
                        <li>Ảnh sẽ tự động được thêm vào danh sách</li>
                    </ol>
                </div>
            </div>
        </div>

        <!-- Hidden file input for camera -->
        <input ref="cameraInputRef" type="file" accept="image/*" capture="environment" class="hidden" @change="onCameraCapture" multiple />

        <!-- Hidden input for legacy paste support -->
        <input ref="hiddenInputRef" type="text" class="absolute opacity-0 pointer-events-none w-1 h-1 -left-full" @paste="onHiddenPaste" />

        <FileUpload ref="fileUploadRef" v-bind="$attrs" :multiple="multiple" :accept="accept" :maxFileSize="maxFileSize" @select="onSelectedFiles">
            <template #header="{ chooseCallback, uploadCallback, clearCallback, files }">
                <div class="flex items-center justify-between mb-2 w-full">
                    <label class="font-bold">{{ label }}</label>
                    <div class="flex gap-2">
                        <slot name="header-buttons" :chooseCallback="chooseCallback" :uploadCallback="uploadCallback" :clearCallback="clearCallback" :files="files">
                            <Button @click="chooseCallback()" icon="pi pi-images" rounded outlined severity="secondary" v-tooltip.top="'Chọn file'"></Button>
                        </slot>

                        <!-- Legacy paste button as fallback -->
                        <Button @click="focusHiddenInput" icon="pi pi-clipboard" rounded outlined severity="info" v-tooltip.top="'Paste (fallback)'" />
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
                            {{ isMobile ? 'Chọn ảnh, chụp ảnh mới hoặc dán vào ô trên' : 'Kéo hoặc paste ảnh vào đây' }}
                        </p>
                    </div>
                </slot>
            </template>

            <!-- Pass through other slots -->
            <template v-for="(_, slotName) in $slots" #[slotName]="slotProps" :key="slotName">
                <slot :name="slotName" v-bind="slotProps" v-if="!['content', 'header-buttons'].includes(slotName)"></slot>
            </template>
        </FileUpload>

        <!-- Success/Error Toast equivalent -->
        <div v-if="showFeedback" class="fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all" :class="feedbackClass">
            <div class="flex items-center gap-2">
                <i :class="feedbackIcon"></i>
                <span>{{ feedbackMessage }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

// Props
const props = defineProps({
    multiple: { type: Boolean, default: true },
    accept: { type: String, default: 'image/*' },
    maxFileSize: { type: Number, default: 5000000 },
    label: { type: String, default: 'Hình ảnh' },
    showPasteZone: { type: Boolean, default: true },
    showInstructions: { type: Boolean, default: true },
    initialFiles: { type: Array, default: () => [] },
    baseUrl: { type: String, default: import.meta.env.VITE_API_URL }
});

// Emits
const emit = defineEmits(['files-updated', 'file-added', 'file-removed', 'paste-success', 'paste-error']);

// Refs
const toast = useToast();
const fileUploadRef = ref(null);
const pasteZoneRef = ref(null);
const pasteInputRef = ref(null);
const hiddenInputRef = ref(null);
const cameraInputRef = ref(null);

// State
const isMobile = ref(false);
const isIOS = ref(false);
const isPasteZoneActive = ref(false);
const pasteZoneMessage = ref('Dán ảnh vào ô bên dưới');
const currentFiles = ref([]);
const pasteText = ref('');

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
        key: `initial-${file.id || file.url}`,
        type: 'initial',
        index: idx
    }));

    const pending = (currentFiles.value || []).map((file, idx) => ({
        ...file,
        url: file.objectURL || URL.createObjectURL(file),
        key: `pending-${file.name + file.size}`,
        type: 'pending',
        index: idx
    }));

    return [...initial, ...pending];
});

// Device detection
const detectDevice = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    isIOS.value = /iPad|iPhone|iPod/.test(userAgent);

    console.log('Device detected:', { isMobile: isMobile.value, isIOS: isIOS.value });
};

// Direct paste handling from textarea
const onDirectPaste = async (event) => {
    console.log('Direct paste event triggered');
    event.preventDefault();

    const items = event.clipboardData?.items;
    if (!items) {
        console.log('No clipboard items found');
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

        // Clear the textarea
        pasteText.value = '';
    } else {
        // Check if there's text content that might be an image URL
        const text = event.clipboardData.getData('text');
        if (text && isImageUrl(text)) {
            try {
                await handleImageUrl(text);
                showSuccessFeedback('Đã thêm ảnh từ URL');
                pasteText.value = '';
            } catch (error) {
                showErrorFeedback('Không thể tải ảnh từ URL');
            }
        } else {
            showErrorFeedback('Không tìm thấy ảnh trong clipboard');
        }
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

// Legacy paste handling
const onHiddenPaste = (event) => {
    console.log('Hidden paste triggered');
    onDirectPaste(event);
};

const focusHiddenInput = () => {
    if (hiddenInputRef.value) {
        hiddenInputRef.value.focus();
        hiddenInputRef.value.select();

        // Try to trigger paste programmatically
        document.execCommand('paste');

        showInfoFeedback('Nhấn Ctrl+V để paste');
    }
};

// Touch events
const onTouchStart = (event) => {
    console.log('Touch start on paste area');
    // Optional: Add haptic feedback for iOS
    if (isIOS.value && navigator.vibrate) {
        navigator.vibrate(50);
    }
};

const onPasteFocus = () => {
    isPasteZoneActive.value = true;
    pasteZoneMessage.value = 'Sẵn sàng nhận ảnh từ clipboard';
};

const onPasteBlur = () => {
    setTimeout(() => {
        isPasteZoneActive.value = false;
        pasteZoneMessage.value = 'Dán ảnh vào ô bên dưới';
    }, 100);
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

    // Add to current files
    currentFiles.value.push(file);

    // Update FileUpload component
    if (fileUploadRef.value?.files) {
        fileUploadRef.value.files.push(file);
    }

    // Emit events
    emit('file-added', file);
    emit('files-updated', {
        all: mergedFileList.value,
        pending: currentFiles.value,
        initial: props.initialFiles
    });

    console.log('File added successfully');
};

const onSelectedFiles = (event) => {
    if (event.files) {
        currentFiles.value = [...event.files];
        emit('files-updated', {
            all: mergedFileList.value,
            pending: currentFiles.value,
            initial: props.initialFiles
        });
    }
};

const handleRemoveFile = (file) => {
    if (file.type === 'initial') {
        emit('file-removed', { file, type: 'initial' });
    } else if (file.type === 'pending') {
        currentFiles.value = currentFiles.value.filter((f) => f.objectURL !== file.url);

        if (file.url.startsWith('blob:')) {
            URL.revokeObjectURL(file.url);
        }

        emit('file-removed', { file, type: 'pending' });
        emit('files-updated', {
            all: mergedFileList.value,
            pending: currentFiles.value,
            initial: props.initialFiles
        });
    }
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
    }, 3000);
};

// Global paste listener
const onGlobalPaste = (event) => {
    // Only handle if not focused on our inputs
    if (event.target !== pasteInputRef.value && event.target !== hiddenInputRef.value) {
        onDirectPaste(event);
    }
};

// Public methods
const clearFiles = () => {
    currentFiles.value.forEach((file) => {
        if (file.objectURL && file.objectURL.startsWith('blob:')) {
            URL.revokeObjectURL(file.objectURL);
        }
    });

    currentFiles.value = [];
    pasteText.value = '';

    if (fileUploadRef.value) {
        fileUploadRef.value.clear();
    }

    emit('files-updated', {
        all: mergedFileList.value,
        pending: currentFiles.value,
        initial: props.initialFiles
    });
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
        if (newFiles && newFiles.length > 0) {
            currentFiles.value = [];

            nextTick(() => {
                emit('files-updated', {
                    all: mergedFileList.value,
                    pending: currentFiles.value,
                    initial: newFiles
                });
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
            if (pasteInputRef.value && document.activeElement !== pasteInputRef.value) {
                event.preventDefault();
                pasteInputRef.value.focus();
            }
        }
    };

    document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    document.removeEventListener('paste', onGlobalPaste);

    currentFiles.value.forEach((file) => {
        if (file.objectURL && file.objectURL.startsWith('blob:')) {
            URL.revokeObjectURL(file.objectURL);
        }
    });
});

// Expose methods
defineExpose({
    clearFiles,
    getFiles,
    openCamera,
    focusHiddenInput
});
</script>

<style scoped>
/* Enhanced paste zone styles */
.paste-zone-active {
    animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
    0%,
    100% {
        border-color: #3b82f6;
        background-color: #eff6ff;
    }
    50% {
        border-color: #1d4ed8;
        background-color: #dbeafe;
    }
}

/* Paste textarea specific styles */
.paste-textarea {
    font-family: system-ui, -apple-system, sans-serif;
    -webkit-appearance: none;
    -webkit-tap-highlight-color: transparent;
}

.paste-textarea:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
}

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