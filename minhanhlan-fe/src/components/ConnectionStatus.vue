<template>
    <div v-if="showStatus" class="fixed top-20 right-4 z-50">
        <div :class="['flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300', statusConfig.class]">
            <i :class="[statusConfig.icon, { 'animate-spin': isReconnecting }]"></i>
            <div class="flex flex-col">
                <span>{{ statusConfig.text }}</span>
                <span v-if="reconnectInfo.reconnectAttempts > 0" class="text-xs opacity-75"> Thử lại: {{ reconnectInfo.reconnectAttempts }}/{{ reconnectInfo.maxReconnectAttempts }} </span>
            </div>

            <!-- Manual retry button when disconnected -->
            <button v-if="!isConnected && !isReconnecting" @click="forceReconnect" class="ml-2 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors">Thử lại</button>
        </div>
    </div>
</template>

<script setup>
import { socketService } from '@/service/SocketService';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const isConnected = ref(false);
const showStatus = ref(false);
const reconnectInfo = ref({});
const isReconnecting = ref(false);
let checkInterval = null;

const statusConfig = computed(() => {
    if (isReconnecting.value) {
        return {
            class: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
            icon: 'pi pi-spin pi-spinner text-yellow-600',
            text: 'Đang kết nối lại...'
        };
    } else if (isConnected.value) {
        return {
            class: 'bg-green-100 text-green-800 border border-green-200',
            icon: 'pi pi-wifi text-green-600',
            text: 'Đã kết nối real-time'
        };
    } else {
        return {
            class: 'bg-red-100 text-red-800 border border-red-200',
            icon: 'pi pi-wifi text-red-600',
            text: 'Mất kết nối real-time'
        };
    }
});

const checkConnection = () => {
    const connectionInfo = socketService.getConnectionInfo();
    const newStatus = connectionInfo.connected;
    const statusChanged = newStatus !== isConnected.value;

    isConnected.value = newStatus;
    reconnectInfo.value = connectionInfo;
    isReconnecting.value = connectionInfo.reconnectAttempts > 0 && !newStatus;

    if (statusChanged) {
        showStatus.value = true;
        // Auto hide after 3 seconds if connected
        if (newStatus) {
            setTimeout(() => {
                showStatus.value = false;
            }, 3000);
        }
    }

    // Always show if disconnected or reconnecting
    if (!newStatus || isReconnecting.value) {
        showStatus.value = true;
    }
};

const forceReconnect = () => {
    socketService.forceReconnect();
};

onMounted(() => {
    checkConnection();
    checkInterval = setInterval(checkConnection, 1000); // Check more frequently
});

onUnmounted(() => {
    if (checkInterval) {
        clearInterval(checkInterval);
    }
});
</script>