<template>
    <div class="mobile-paste-file-upload mt-2" ref="pasteZoneRef" @paste="onDirectPaste">
        <!-- Hidden file input for camera -->
        <input ref="cameraInputRef" type="file" :accept="accept" :capture="captureMode" class="hidden" @change="onCameraCapture" multiple />

        <!-- Hidden input for paste support -->
        <input ref="hiddenInputRef" type="text" class="absolute opacity-0 pointer-events-none w-1 h-1 -left-full" @paste="onDirectPaste" />

        <FileUpload ref="fileUploadRef" v-bind="$attrs" :multiple="multiple" :accept="accept" :maxFileSize="maxFileSize" @select="onSelectedFiles">
            <template #header="{ chooseCallback, uploadCallback, clearCallback, files }">
                <div class="flex items-center justify-between mb-2 w-full">
                    <label class="font-bold">{{ label }}</label>
                    <div class="flex gap-2">
                        <slot name="header-buttons" :chooseCallback="chooseCallback" :uploadCallback="uploadCallback" :clearCallback="clearCallback" :files="files">
                            <Button @click="chooseCallback()" icon="pi pi-folder-open" rounded outlined severity="secondary" v-tooltip.top="'Chọn file'"></Button>
                        </slot>

                        <!-- Camera button for mobile -->
                        <Button v-if="isMobile && supportsVideo" @click="openCamera('photo')" icon="pi pi-camera" rounded outlined severity="secondary" v-tooltip.top="'Chụp ảnh'" />

                        <!-- Video button for mobile -->
                        <Button v-if="isMobile && supportsVideo" @click="openCamera('video')" icon="pi pi-video" rounded outlined severity="info" v-tooltip.top="'Quay video'" />

                        <!-- Paste button -->
                        <Button @click="triggerPaste" icon="pi pi-clipboard" rounded outlined severity="info" v-tooltip.top="'Dán file'" />
                    </div>
                </div>
            </template>

            <template #content="slotProps">
                <slot name="content" v-bind="slotProps" :merged-files="mergedFileList">
                    <!-- File previews -->
                    <div class="flex flex-wrap gap-4 mb-4" v-if="mergedFileList.length > 0">
                        <div v-for="file in mergedFileList" :key="file.key" class="relative w-[120px] h-[100px] rounded-lg border border-surface overflow-hidden flex-shrink-0 bg-white shadow-sm">
                            <button @click="handleRemoveFile(file)" class="absolute top-1 right-1 w-6 h-6 text-red-500 flex items-center justify-center z-20 hover:bg-red-100 rounded-full bg-white/90 shadow-sm transition-all">
                                <i class="pi pi-times text-xs"></i>
                            </button>

                            <!-- Debug info (remove in production) -->
                            <div class="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 rounded z-10">
                                {{ file.type === 'initial' ? 'OLD' : 'NEW' }}
                            </div>

                            <!-- Image preview -->
                            <div v-if="isImage(file)" class="w-full h-full">
                                <Image :src="file.url" :alt="file.name" class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" preview @error="handleImageError(file)" />
                                <div class="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded"><i class="pi pi-image mr-1"></i>Ảnh</div>
                            </div>

                            <!-- Video preview -->
                            <div v-else-if="isVideo(file)" class="w-full h-full relative bg-gray-800 flex items-center justify-center group">
                                <video :src="file.url" class="w-full h-full object-cover" muted preload="metadata">
                                    <source :src="file.url" :type="file.type || getVideoType(file.url)" />
                                </video>
                                <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 group-hover:bg-opacity-60 transition-opacity cursor-pointer" @click="playVideo(file.url)">
                                    <div class="w-12 h-12 bg-white bg-opacity-90 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                        <i class="pi pi-play text-gray-700 text-lg ml-1"></i>
                                    </div>
                                </div>
                                <div class="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded"><i class="pi pi-video mr-1"></i>Video</div>
                                <!-- File size indicator -->
                                <div class="absolute top-1 right-8 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                                    {{ formatFileSize(file.size) }}
                                </div>
                            </div>

                            <!-- Unknown file types or loading -->
                            <div v-else class="w-full h-full relative bg-gray-100 flex items-center justify-center">
                                <div class="text-center p-2">
                                    <i class="pi pi-file text-2xl text-gray-500 mb-1"></i>
                                    <div class="text-xs text-gray-600 truncate max-w-[80px]" :title="file.name">{{ file.name }}</div>
                                    <div class="text-xs text-gray-400 mt-1">{{ file.type || 'Unknown' }}</div>
                                    <div class="text-xs text-gray-400">{{ formatFileSize(file.size) }}</div>
                                </div>
                            </div>

                            <!-- Loading indicator for large files -->
                            <div v-if="file.loading" class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-center flex-col py-8 text-center">
                        <i class="pi pi-cloud-upload !border-2 !rounded-full !p-5 !text-4xl !text-muted-color mb-4" />
                        <p class="mb-2 font-medium">
                            {{ isMobile ? getUploadHintMobile() : getUploadHintDesktop() }}
                        </p>
                        <p v-if="isMobile" class="text-sm text-gray-500 mt-2">💡 Mẹo: Copy file từ ứng dụng → Mở browser → Nhấn nút Dán</p>
                        <p class="text-xs text-gray-400 mt-2">{{ getSupportedFormatsText() }}</p>
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

        <!-- Video Player Modal -->
        <div v-if="showVideoPlayer" class="fixed inset-0 z-[9999] bg-black bg-opacity-95 flex items-center justify-center" @click="closeVideoPlayer">
            <div class="relative max-w-[95vw] max-h-[95vh]" @click.stop>
                <button @click="closeVideoPlayer" class="absolute -top-10 right-0 text-white hover:text-gray-300 text-xl">
                    <i class="pi pi-times"></i>
                </button>
                <video ref="videoPlayerRef" :src="currentVideoUrl" controls autoplay class="max-w-full max-h-full">
                    <source :src="currentVideoUrl" type="video/mp4" />
                    <source :src="currentVideoUrl" type="video/webm" />
                    <source :src="currentVideoUrl" type="video/ogg" />
                    Trình duyệt không hỗ trợ video.
                </video>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

// Props
const props = defineProps({
    multiple: { type: Boolean, default: true },
    accept: { type: String, default: 'image/*,video/*,.mp4,.avi,.mov,.wmv,.webm,.ogg,.mkv,.flv' },
    maxFileSize: { type: Number, default: 50000000 }, // 50MB for video support
    label: { type: String, default: 'File multimedia' },
    initialFiles: { type: Array, default: () => [] },
    baseUrl: { type: String, default: import.meta.env.VITE_API_URL },
    supportVideo: { type: Boolean, default: true },
    supportImage: { type: Boolean, default: true }
});

// Emits
const emit = defineEmits(['files-updated', 'file-added', 'file-removed', 'paste-success', 'paste-error']);

// Refs
const fileUploadRef = ref(null);
const pasteZoneRef = ref(null);
const hiddenInputRef = ref(null);
const cameraInputRef = ref(null);
const videoPlayerRef = ref(null);

// State
const isMobile = ref(false);
const currentFiles = ref([]);
const showVideoPlayer = ref(false);
const currentVideoUrl = ref('');

// Feedback system
const showFeedback = ref(false);
const feedbackMessage = ref('');
const feedbackType = ref('success');

// Computed
const supportsVideo = computed(() => props.supportVideo);
const supportsImage = computed(() => props.supportImage);

const captureMode = computed(() => {
    if (props.accept.includes('video')) return 'environment';
    return 'environment';
});

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

const mergedFileList = computed(() => {
    const initial = (props.initialFiles || []).map((file, idx) => ({
        ...file,
        url: file.url.startsWith('http') ? file.url : props.baseUrl + file.url,
        key: `initial-${file.id || file.url}-${idx}`,
        type: 'initial',
        index: idx
    }));

    const pending = (currentFiles.value || []).map((file, idx) => {
        const fileData = {
            ...file,
            url: file.objectURL || URL.createObjectURL(file),
            key: `pending-${file.name}-${file.size}-${idx}`,
            type: 'pending',
            index: idx,
            name: file.name,
            size: file.size,
            mimeType: file.type
        };

        console.log('Merged file data:', {
            name: fileData.name,
            type: fileData.mimeType,
            url: fileData.url,
            isImage: isImage(fileData),
            isVideo: isVideo(fileData)
        });

        return fileData;
    });

    const result = [...initial, ...pending];
    console.log('Merged file list:', result.length, 'files');
    return result;
});

// File type detection - Enhanced version
const isImage = (file) => {
    if (!file) return false;

    // Check by MIME type first (most reliable)
    if (file.type) {
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/svg+xml'];
        if (imageTypes.includes(file.type.toLowerCase())) {
            return true;
        }
    }

    // Check by file extension
    const fileName = file.name || file.url || '';
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i;

    return imageExtensions.test(fileName);
};

const isVideo = (file) => {
    if (!file) return false;

    // Check by MIME type first (most reliable)
    if (file.type) {
        const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/mkv', 'video/m4v', 'video/3gp', 'video/quicktime', 'video/x-msvideo'];
        if (videoTypes.includes(file.type.toLowerCase())) {
            return true;
        }
    }

    // Check by file extension
    const fileName = file.name || file.url || '';
    const videoExtensions = /\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv|m4v|3gp)$/i;

    return videoExtensions.test(fileName);
};

// Utility function to format file size
const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getVideoType = (url) => {
    if (url.includes('.mp4')) return 'video/mp4';
    if (url.includes('.webm')) return 'video/webm';
    if (url.includes('.ogg')) return 'video/ogg';
    if (url.includes('.avi')) return 'video/avi';
    if (url.includes('.mov')) return 'video/quicktime';
    if (url.includes('.wmv')) return 'video/wmv';
    if (url.includes('.mkv')) return 'video/mkv';
    if (url.includes('.flv')) return 'video/flv';
    if (url.includes('.m4v')) return 'video/mp4';
    if (url.includes('.3gp')) return 'video/3gpp';
    return 'video/mp4';
};

// UI Text helpers
const getUploadHintMobile = () => {
    const hints = [];
    if (props.supportImage) hints.push('chụp/chọn ảnh');
    if (props.supportVideo) hints.push('quay/chọn video');
    hints.push('dán file');
    return `Có thể ${hints.join(', ')}`;
};

const getUploadHintDesktop = () => {
    const hints = [];
    if (props.supportImage) hints.push('ảnh');
    if (props.supportVideo) hints.push('video');
    return `Kéo hoặc dán ${hints.join('/')} vào đây`;
};

const getSupportedFormatsText = () => {
    const formats = [];
    if (props.supportImage) formats.push('JPG, PNG, GIF, WebP, BMP');
    if (props.supportVideo) formats.push('MP4, AVI, MOV, WMV, WebM, OGG, MKV');
    return `Hỗ trợ: ${formats.join(' | ')}`;
};

// Device detection
const detectDevice = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
};

// Video player
const playVideo = (url) => {
    currentVideoUrl.value = url;
    showVideoPlayer.value = true;
    nextTick(() => {
        if (videoPlayerRef.value) {
            videoPlayerRef.value.play().catch(console.error);
        }
    });
};

const closeVideoPlayer = () => {
    showVideoPlayer.value = false;
    currentVideoUrl.value = '';
    if (videoPlayerRef.value) {
        videoPlayerRef.value.pause();
    }
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

    let hasFile = false;
    const newFiles = [];

    for (const item of items) {
        console.log('Clipboard item type:', item.type);

        // Check for images
        if (item.type.startsWith('image/') && props.supportImage) {
            hasFile = true;
            const file = item.getAsFile();
            if (file) {
                console.log('Image file found:', file.name, file.size);
                newFiles.push(file);
            }
        }

        // Check for videos
        else if (item.type.startsWith('video/') && props.supportVideo) {
            hasFile = true;
            const file = item.getAsFile();
            if (file) {
                console.log('Video file found:', file.name, file.size);
                newFiles.push(file);
            }
        }
    }

    if (hasFile && newFiles.length > 0) {
        for (const file of newFiles) {
            await handlePastedFile(file);
        }
        const fileType = newFiles.some((f) => f.type.startsWith('video/')) ? 'video' : 'ảnh';
        showSuccessFeedback(`Đã thêm ${newFiles.length} ${fileType}`);
    } else {
        // Check if there's text content that might be a media URL
        const text = event.clipboardData.getData('text');
        if (text && isMediaUrl(text)) {
            try {
                await handleMediaUrl(text);
                showSuccessFeedback('Đã thêm file từ URL');
            } catch (error) {
                showErrorFeedback('Không thể tải file từ URL');
            }
        } else {
            showErrorFeedback('Không tìm thấy file multimedia trong clipboard');
        }
    }
};

// Trigger paste manually
const triggerPaste = async () => {
    try {
        // Similar logic as before but with video support
        if (isMobile.value && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
            console.log('Safari mobile detected, using alternative method');
            if (hiddenInputRef.value) {
                hiddenInputRef.value.focus();
                hiddenInputRef.value.select();
                try {
                    const success = document.execCommand('paste');
                    if (!success) {
                        showInfoFeedback('Vui lòng:\n1. Nhấn giữ vào ô input\n2. Chọn "Paste"\n3. Hoặc sử dụng nút Chọn file');
                        return;
                    }
                } catch (e) {
                    showInfoFeedback('Vui lòng:\n1. Nhấn giữ vào ô input\n2. Chọn "Paste"\n3. Hoặc sử dụng nút Chọn file');
                    return;
                }
            }
            return;
        }

        if (!navigator.clipboard || !navigator.clipboard.read) {
            if (isMobile.value) {
                showInfoFeedback('Trình duyệt không hỗ trợ dán tự động.\nVui lòng sử dụng nút "Chọn file"');
            } else {
                if (hiddenInputRef.value) {
                    hiddenInputRef.value.focus();
                    hiddenInputRef.value.select();
                }
                showInfoFeedback('Vui lòng nhấn Ctrl+V để dán');
            }
            return;
        }

        try {
            const permission = await navigator.permissions.query({ name: 'clipboard-read' });
            console.log('Clipboard permission:', permission.state);

            if (permission.state === 'denied') {
                showInfoFeedback('Quyền truy cập clipboard bị từ chối.\nVui lòng sử dụng nút "Chọn file"');
                return;
            }
        } catch (permError) {
            console.log('Permission API not available');
        }

        try {
            const clipboardItems = await navigator.clipboard.read();

            let foundFile = false;
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if ((type.startsWith('image/') && props.supportImage) || (type.startsWith('video/') && props.supportVideo)) {
                        foundFile = true;
                        const blob = await clipboardItem.getType(type);
                        const fileExtension = type.split('/')[1];
                        const fileName = `pasted-file-${Date.now()}.${fileExtension}`;
                        const file = new File([blob], fileName, { type });
                        await handlePastedFile(file);
                        const fileType = type.startsWith('video/') ? 'video' : 'ảnh';
                        showSuccessFeedback(`Đã dán ${fileType} thành công`);
                        return;
                    }
                }
            }

            if (!foundFile) {
                showInfoFeedback('Không có file multimedia trong clipboard.\nHãy copy file trước khi dán');
            }
        } catch (clipboardError) {
            console.log('Clipboard read error:', clipboardError);
            if (isMobile.value) {
                showInfoFeedback('Không thể đọc clipboard tự động.\n\nCách khác:\n1. Sử dụng nút "Chọn file"\n2. Hoặc refresh trang và thử lại');
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
        showErrorFeedback('Lỗi khi dán. Vui lòng sử dụng nút "Chọn file"');
    }
};

// Check if text is a media URL
const isMediaUrl = (text) => {
    const mediaExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|mp4|webm|ogg|avi|mov|wmv|mkv|flv|m4v|3gp)$/i;
    const urlPattern = /^https?:\/\/.+/;
    return urlPattern.test(text) && mediaExtensions.test(text);
};

// Handle media URL
const handleMediaUrl = async (url) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        if (blob.type.startsWith('image/') || blob.type.startsWith('video/')) {
            const fileName = url.split('/').pop() || `media-${Date.now()}.${blob.type.split('/')[1]}`;
            const file = new File([blob], fileName, { type: blob.type });
            await handlePastedFile(file);
        } else {
            throw new Error('URL does not point to a media file');
        }
    } catch (error) {
        throw error;
    }
};

// Camera functionality with mode support
const openCamera = (mode = 'photo') => {
    if (cameraInputRef.value) {
        // Update input accept and capture attributes based on mode
        if (mode === 'video') {
            cameraInputRef.value.setAttribute('accept', 'video/*,.mp4,.avi,.mov,.wmv,.webm,.ogg,.mkv');
            cameraInputRef.value.setAttribute('capture', 'camcorder');
        } else {
            cameraInputRef.value.setAttribute('accept', 'image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp');
            cameraInputRef.value.setAttribute('capture', 'environment');
        }
        cameraInputRef.value.click();
    }
};

const onCameraCapture = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
        const processedFiles = Array.from(files).map((file) => {
            // Create object URL for immediate preview
            file.objectURL = URL.createObjectURL(file);
            return file;
        });

        // Add to current files (don't replace, append)
        currentFiles.value = [...currentFiles.value, ...processedFiles];

        // Sync with FileUpload component
        syncWithFileUpload();

        // Emit updates
        processedFiles.forEach((file) => {
            emit('file-added', file);
        });
        emitFilesUpdated();

        const fileType = processedFiles.some((f) => f.type.startsWith('video/')) ? 'video' : 'ảnh';
        showSuccessFeedback(`Đã chụp/quay ${files.length} ${fileType}`);

        // Reset input
        event.target.value = '';
    }
};

// File handling
const handlePastedFile = async (file) => {
    console.log('Processing pasted file:', file.name, file.type, file.size);

    // Enhanced file type validation
    const isValidImage = (file.type.startsWith('image/') || isImage(file)) && props.supportImage;
    const isValidVideo = (file.type.startsWith('video/') || isVideo(file)) && props.supportVideo;

    if (!isValidImage && !isValidVideo) {
        showErrorFeedback(`File "${file.name}" không được hỗ trợ. Chỉ chấp nhận ảnh và video.`);
        return;
    }

    // Validate file size
    if (props.maxFileSize && file.size > props.maxFileSize) {
        const maxMB = (props.maxFileSize / 1024 / 1024).toFixed(1);
        showErrorFeedback(`File "${file.name}" quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa: ${maxMB}MB`);
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
        currentFiles.value = [...event.files];
        emitFilesUpdated();
    }
};

const syncWithFileUpload = () => {
    if (fileUploadRef.value) {
        fileUploadRef.value.files = [...currentFiles.value];
    }
};

const handleRemoveFile = (file) => {
    console.log('Removing file:', file);

    if (file.type === 'initial') {
        emit('file-removed', { file, type: 'initial' });
    } else if (file.type === 'pending') {
        currentFiles.value = currentFiles.value.filter((f, index) => {
            const fileKey = `pending-${f.name}-${f.size}-${index}`;
            return fileKey !== file.key;
        });

        if (file.url && file.url.startsWith('blob:')) {
            URL.revokeObjectURL(file.url);
        }

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

// Feedback system methods
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
    }, 5000);
};

// Global paste listener
const onGlobalPaste = (event) => {
    if (event.target === document.body || pasteZoneRef.value?.contains(event.target)) {
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
    document.addEventListener('paste', onGlobalPaste);

    const handleKeyDown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }
            event.preventDefault();
            triggerPaste();
        }

        // ESC to close video player
        if (event.key === 'Escape' && showVideoPlayer.value) {
            closeVideoPlayer();
        }
    };

    document.addEventListener('keydown', handleKeyDown);

    onUnmounted(() => {
        document.removeEventListener('paste', onGlobalPaste);
        document.removeEventListener('keydown', handleKeyDown);
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
    triggerPaste,
    playVideo
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

/* Video preview styling */
video {
    border-radius: 6px;
}

.video-overlay {
    background: linear-gradient(45deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.3));
}

/* Hidden file input */
.hidden {
    display: none !important;
}

/* Video player modal */
.video-player-modal {
    backdrop-filter: blur(4px);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .mobile-paste-zone {
        min-height: 80px;
        touch-action: manipulation;
    }

    video {
        max-height: 70vh;
    }
}
</style>