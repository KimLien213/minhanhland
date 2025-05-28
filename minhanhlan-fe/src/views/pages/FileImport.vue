
<template>
    <div class="card" @paste="onPaste">
        <Toast />
        <FileUpload ref="fileUploadRef" name="excel" url="/api/upload-excel" @upload="onTemplatedUpload($event)" :multiple="true" accept=".xlsx,.xls" :maxFileSize="5000000" @select="onSelectedFiles">
            <template #header="{ chooseCallback, uploadCallback, clearCallback, files }">
                <div class="flex flex-wrap justify-between items-center flex-1 gap-4">
                    <div class="flex gap-2">
                        <Button @click="chooseCallback()" icon="pi pi-file-excel" rounded outlined severity="secondary"></Button>
                        <Button @click="uploadEvent(uploadCallback)" icon="pi pi-cloud-upload" rounded outlined severity="success" :disabled="!files || files.length === 0"></Button>
                        <Button @click="clearCallback()" icon="pi pi-times" rounded outlined severity="danger" :disabled="!files || files.length === 0"></Button>
                    </div>
                </div>
            </template>

            <template #content="{ files, uploadedFiles, removeUploadedFileCallback, removeFileCallback }">
                <div class="flex flex-col gap-8 pt-4">
                    <div v-if="files.length > 0">
                        <h5>Pending</h5>
                        <div class="flex flex-wrap gap-4">
                            <div v-for="(file, index) of files" :key="file.name" class="p-8 rounded-border flex flex-col border border-surface items-center gap-2">
                                <span class="font-semibold text-ellipsis max-w-60 whitespace-nowrap overflow-hidden">{{ file.name }}</span>
                                <div>{{ formatSize(file.size) }}</div>
                                <Badge value="Pending" severity="warn" />
                                <Button icon="pi pi-times" @click="onRemoveTemplatingFile(file, removeFileCallback, index)" outlined rounded severity="danger" />
                            </div>
                        </div>
                    </div>

                    <div v-if="uploadedFiles.length > 0">
                        <h5>Completed</h5>
                        <div class="flex flex-wrap gap-4">
                            <div v-for="(file, index) of uploadedFiles" :key="file.name" class="p-8 rounded-border flex flex-col border border-surface items-center gap-2">
                                <span class="font-semibold text-ellipsis max-w-60 whitespace-nowrap overflow-hidden">{{ file.name }}</span>
                                <div>{{ formatSize(file.size) }}</div>
                                <Badge value="Completed" class="mt-2" severity="success" />
                                <Button icon="pi pi-times" @click="removeUploadedFileCallback(index)" outlined rounded severity="danger" />
                            </div>
                        </div>
                    </div>
                </div>
            </template>

            <template #empty>
                <div class="flex items-center justify-center flex-col">
                    <i class="pi pi-file-excel !border-2 !rounded-full !p-8 !text-4xl !text-muted-color" />
                    <p class="mt-6 mb-0">Kéo thả hoặc chọn file Excel để tải lên.</p>
                </div>
            </template>
        </FileUpload>
    </div>
</template>

<script setup>
import { importExcelService } from '@/service/ImportExcel';
import { usePrimeVue } from 'primevue/config';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';

const toast = useToast();
const $primevue = usePrimeVue();

const totalSize = ref(0);
const totalSizePercent = ref(0);
const files = ref([]);
const fileUploadRef = ref(null);

// Paste handling (optional, here just to clear paste behavior)
const onPaste = (event) => {
    // Optional: disable default paste for Excel
    event.preventDefault();
};

const onRemoveTemplatingFile = (file, removeFileCallback, index) => {
    removeFileCallback(index);
    totalSize.value -= parseInt(formatSize(file.size));
};

const onClearTemplatingUpload = (clear) => {
    clear();
    totalSize.value = 0;
    totalSizePercent.value = 0;
};

const onSelectedFiles = (event) => {
    files.value = event.files;
    files.value.forEach((file) => {
        totalSize.value += parseInt(formatSize(file.size));
    });
};

const uploadEvent = async (callback) => {
    const files = fileUploadRef.value?.files;

    if (!files || files.length === 0) {
        toast.add({
            severity: 'warn',
            summary: 'Không có file',
            detail: 'Vui lòng chọn ít nhất 1 file Excel.',
            life: 1000
        });
        return;
    }

    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }

    try {
        const res = await importExcelService.import(formData);

        toast.add({
            severity: 'success',
            summary: 'Thành công',
            detail: `Đã import ${res.data.importedCount} sản phẩm.`,
            life: 1000
        });

        fileUploadRef.value.clear(); // reset lại file sau khi upload
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Lỗi import',
            detail: 'Không thể import file. Vui lòng kiểm tra định dạng hoặc dữ liệu.',
            life: 1000
        });
    }
    window.location.reload();
};

const onTemplatedUpload = () => {
    toast.add({ severity: 'info', summary: 'Success', detail: 'Excel Uploaded', life: 3000 });
};

const formatSize = (bytes) => {
    const k = 1024;
    const dm = 2;
    const sizes = $primevue.config.locale.fileSizeTypes || ['B', 'KB', 'MB', 'GB'];

    if (bytes === 0) return `0 ${sizes[0]}`;

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${formattedSize} ${sizes[i]}`;
};
</script>
