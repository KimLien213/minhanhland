<template>
    <div class="mobile-paste-file-upload" @paste="onPaste" @touchstart="handleTouchStart" ref="pasteZoneRef">
        <!-- Mobile paste zone -->
        <div
            v-if="isMobile && showPasteZone"
            class="mb-4 p-4 border-2 border-dashed rounded-lg transition-all duration-300 cursor-pointer"
            :class="isPasteZoneActive ? 'border-blue-500 bg-blue-50 paste-zone-active' : 'border-gray-300 bg-gray-50 hover:border-gray-400'"
            @click="activatePasteZone"
        >
            <div class="flex flex-col items-center justify-center text-center">
                <i class="pi pi-clipboard text-2xl mb-2" :class="isPasteZoneActive ? 'text-blue-500' : 'text-gray-500'"></i>
                <p class="text-sm font-medium" :class="isPasteZoneActive ? 'text-blue-700' : 'text-gray-600'">
                    {{ pasteZoneMessage }}
                </p>
                <p v-if="isPasteZoneActive" class="text-xs text-blue-600 mt-1">Vùng này đang hoạt động để nhận ảnh từ clipboard</p>
            </div>
        </div>

        <!-- Hidden input for mobile paste capture -->
        <input ref="invisibleInputRef" type="text" class="sr-only" @paste="onMobilePaste" @blur="deactivatePasteZone" />

        <FileUpload ref="fileUploadRef" v-bind="$attrs" :multiple="multiple" :accept="accept" :maxFileSize="maxFileSize" @select="onSelectedFiles">
            <template #header="{ chooseCallback, uploadCallback, clearCallback, files }">
                <div class="flex items-center justify-between mb-2 w-full">
                    <label class="font-bold">{{ label }}</label>
                    <div class="flex gap-2">
                        <!-- Custom header buttons -->
                        <slot name="header-buttons" :chooseCallback="chooseCallback" :uploadCallback="uploadCallback" :clearCallback="clearCallback" :files="files">
                            <!-- Default buttons -->
                            <Button @click="chooseCallback()" icon="pi pi-images" rounded outlined severity="secondary" v-tooltip.top="'Chọn file'"></Button>
                        </slot>

                        <!-- Mobile paste button -->
                        <Button v-if="isMobile && showPasteButton" @click="activatePasteZone" icon="pi pi-clipboard" rounded outlined severity="info" v-tooltip.top="'Dán ảnh từ clipboard'"></Button>
                    </div>
                </div>
            </template>

            <template #content="slotProps">
                <slot name="content" v-bind="slotProps" :merged-files="mergedFileList">
                    <!-- Default content -->
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
                            {{ isMobile ? 'Chọn ảnh, chụp ảnh mới hoặc dán từ clipboard' : 'Kéo hoặc paste ảnh vào đây' }}
                        </p>

                        <!-- Mobile specific instructions -->
                        <div v-if="isMobile && showInstructions" class="text-xs text-gray-500 mt-2 max-w-xs">
                            <p class="font-medium text-gray-600 mb-1">💡 Để dán ảnh từ clipboard:</p>
                            <div class="space-y-1">
                                <p>1. Copy ảnh từ ứng dụng khác</p>
                                <p>2. Nhấn vào vùng dán ảnh ở trên</p>
                                <p>3. Chọn "Dán" hoặc nhấn Ctrl+V</p>
                            </div>
                        </div>
                    </div>
                </slot>
            </template>

            <!-- Pass through other slots -->
            <template v-for="(_, slotName) in $slots" #[slotName]="slotProps" :key="slotName">
                <slot :name="slotName" v-bind="slotProps" v-if="!['content', 'header-buttons'].includes(slotName)"></slot>
            </template>
        </FileUpload>
    </div>
</template>

<script setup>
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

// Props
const props = defineProps({
    // FileUpload props
    multiple: {
        type: Boolean,
        default: true
    },
    accept: {
        type: String,
        default: 'image/*'
    },
    maxFileSize: {
        type: Number,
        default: 5000000 // 5MB
    },
    label: {
        type: String,
        default: 'Hình ảnh'
    },

    // Mobile paste specific props
    showPasteZone: {
        type: Boolean,
        default: true
    },
    showPasteButton: {
        type: Boolean,
        default: true
    },
    showInstructions: {
        type: Boolean,
        default: true
    },

    // File management
    initialFiles: {
        type: Array,
        default: () => []
    },
    pendingFiles: {
        type: Array,
        default: () => []
    },

    // Base URL for initial files
    baseUrl: {
        type: String,
        default: import.meta.env.VITE_API_URL
    }
});

// Emits
const emit = defineEmits(['files-updated', 'file-added', 'file-removed', 'paste-success', 'paste-error']);

// Refs
const toast = useToast();
const fileUploadRef = ref(null);
const pasteZoneRef = ref(null);
const invisibleInputRef = ref(null);

// State
const isMobile = ref(false);
const isPasteZoneActive = ref(false);
const pasteZoneMessage = ref('Nhấn để dán ảnh từ clipboard');
const currentFiles = ref([]);

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

// Methods
const handleResize = () => {
    isMobile.value = window.innerWidth <= 768;
};

const onPaste = (event) => {
    event.preventDefault();

    const items = event.clipboardData?.items;
    if (!items) return;

    let imageFound = false;
    const newFiles = [];

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            imageFound = true;
            const file = item.getAsFile();
            if (file) {
                newFiles.push(file);
            }
        }
    }

    if (imageFound && newFiles.length > 0) {
        newFiles.forEach((file) => handlePastedFile(file));
        showPasteSuccess(newFiles.length);
    } else {
        showPasteError('Không tìm thấy ảnh trong clipboard');
    }
};

const onMobilePaste = async (event) => {
    event.preventDefault();

    try {
        // Try modern Clipboard API first
        if (navigator.clipboard && navigator.clipboard.read) {
            const clipboardItems = await navigator.clipboard.read();
            const newFiles = [];

            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        const file = new File([blob], `pasted-image-${Date.now()}.${type.split('/')[1]}`, { type });
                        newFiles.push(file);
                    }
                }
            }

            if (newFiles.length > 0) {
                newFiles.forEach((file) => handlePastedFile(file));
                showPasteSuccess(newFiles.length);
                return;
            }
        }

        // Fallback to traditional paste
        onPaste(event);
    } catch (error) {
        console.error('Mobile paste failed:', error);
        showPasteError('Không thể dán ảnh. Vui lòng thử chọn file thay thế.');
    }
};

const handlePastedFile = (file) => {
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
};

const activatePasteZone = () => {
    if (!isMobile.value) return;

    isPasteZoneActive.value = true;
    pasteZoneMessage.value = 'Nhấn Ctrl+V hoặc giữ và chọn "Dán"';

    // Focus invisible input to capture paste
    nextTick(() => {
        if (invisibleInputRef.value) {
            invisibleInputRef.value.focus();
        }
    });

    // Auto deactivate after 5 seconds
    setTimeout(() => {
        deactivatePasteZone();
    }, 5000);
};

const deactivatePasteZone = () => {
    isPasteZoneActive.value = false;
    pasteZoneMessage.value = 'Nhấn để dán ảnh từ clipboard';
};

const handleTouchStart = (event) => {
    if (!isMobile.value) return;

    const touch = event.touches[0];
    const startTime = Date.now();

    const handleTouchEnd = () => {
        const duration = Date.now() - startTime;
        if (duration > 500) {
            // Long press
            activatePasteZone();
        }
        document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchend', handleTouchEnd);
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
        // Emit event to parent to handle initial file removal
        emit('file-removed', { file, type: 'initial' });
    } else if (file.type === 'pending') {
        // Remove from current files
        currentFiles.value = currentFiles.value.filter((f) => f.objectURL !== file.url);

        // Clean up object URL
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

const showPasteSuccess = (count = 1) => {
    toast.add({
        severity: 'success',
        summary: 'Dán ảnh thành công',
        detail: `${count} ảnh đã được thêm vào danh sách`,
        life: 2000
    });

    deactivatePasteZone();
    emit('paste-success', { count });
};

const showPasteError = (message) => {
    toast.add({
        severity: 'warn',
        summary: 'Không thể dán ảnh',
        detail: message,
        life: 3000
    });

    deactivatePasteZone();
    emit('paste-error', { message });
};

const handleKeyDown = (event) => {
    // Handle Ctrl+V or Cmd+V
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        if (isMobile.value) {
            event.preventDefault();
            onMobilePaste(event);
        }
    }
};

// Public methods
const clearFiles = () => {
    // Clean up object URLs
    currentFiles.value.forEach((file) => {
        if (file.objectURL && file.objectURL.startsWith('blob:')) {
            URL.revokeObjectURL(file.objectURL);
        }
    });

    currentFiles.value = [];

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

// Watch for initialFiles changes (when editing)
watch(
    () => props.initialFiles,
    (newFiles) => {
        if (newFiles && newFiles.length > 0) {
            // Clear current files when loading initial files (edit mode)
            currentFiles.value = [];

            // Emit update với initial files
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

// Watch for pendingFiles prop changes (external control)
watch(
    () => props.pendingFiles,
    (newFiles) => {
        if (newFiles) {
            currentFiles.value = [...newFiles];

            nextTick(() => {
                emit('files-updated', {
                    all: mergedFileList.value,
                    pending: currentFiles.value,
                    initial: props.initialFiles
                });
            });
        }
    },
    { immediate: true, deep: true }
);

// Lifecycle
onMounted(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('keydown', handleKeyDown);

    // Clean up object URLs
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
    activatePasteZone,
    deactivatePasteZone
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

/* Mobile specific styles */
@media (max-width: 768px) {
    .mobile-paste-zone {
        min-height: 80px;
        touch-action: manipulation;
    }
}

/* Hide invisible input */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
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
</style>