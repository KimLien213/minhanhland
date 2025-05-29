// src/components/ConnectionStatus.vue - Enhanced version
<template>
    <div v-if="showStatus" class="fixed top-20 right-4 z-50">
        <div :class="['flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300', statusConfig.class]">
            <i :class="[statusConfig.icon, { 'animate-spin': isReconnecting }]"></i>
            <div class="flex flex-col">
                <span>{{ statusConfig.text }}</span>
                <span v-if="reconnectInfo.reconnectAttempts > 0" class="text-xs opacity-75"> Thử lại: {{ reconnectInfo.reconnectAttempts }}/{{ reconnectInfo.maxReconnectAttempts }} </span>
                <span v-if="connectionInfo.currentRoom" class="text-xs opacity-75"> Room: {{ connectionInfo.currentRoom.subdivision }}-{{ connectionInfo.currentRoom.apartmentType }} </span>
            </div>

            <!-- Manual retry button when disconnected -->
            <button v-if="!isConnected && !isReconnecting" @click="forceReconnect" class="ml-2 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors">Thử lại</button>

            <!-- Debug info button -->
            <button v-if="showDebug" @click="toggleDebugInfo" class="ml-2 px-1 py-1 bg-white/20 hover:bg-white/30 rounded text-xs transition-colors">🔍</button>
        </div>

        <!-- Debug panel -->
        <div v-if="showDebugPanel" class="mt-2 bg-gray-800 text-white p-3 rounded-lg text-xs max-w-xs">
            <div><strong>Connected:</strong> {{ connectionInfo.connected }}</div>
            <div><strong>Socket ID:</strong> {{ socketService.socket?.id || 'N/A' }}</div>
            <div><strong>Room:</strong> {{ connectionInfo.currentRoom ? `${connectionInfo.currentRoom.subdivision}-${connectionInfo.currentRoom.apartmentType}` : 'None' }}</div>
            <div><strong>Attempts:</strong> {{ connectionInfo.reconnectAttempts }}/{{ connectionInfo.maxReconnectAttempts }}</div>
            <div><strong>Next delay:</strong> {{ connectionInfo.nextReconnectDelay }}ms</div>
            <div><strong>Is connecting:</strong> {{ connectionInfo.isConnecting }}</div>
        </div>
    </div>
</template>

<script setup>
import { socketService } from '@/service/SocketService';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const isConnected = ref(false);
const showStatus = ref(false);
const reconnectInfo = ref({});
const connectionInfo = ref({});
const isReconnecting = ref(false);
const showDebugPanel = ref(false);
const showDebug = ref(import.meta.env.DEV); // Only show in development
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
    const info = socketService.getConnectionInfo();
    const newStatus = info.connected;
    const statusChanged = newStatus !== isConnected.value;

    isConnected.value = newStatus;
    connectionInfo.value = info;
    reconnectInfo.value = info;
    isReconnecting.value = info.isConnecting || (info.reconnectAttempts > 0 && !newStatus);

    if (statusChanged) {
        showStatus.value = true;
        console.log('🔌 Connection status changed:', newStatus ? 'Connected' : 'Disconnected');

        // Auto hide after 3 seconds if connected
        if (newStatus) {
            setTimeout(() => {
                if (!showDebugPanel.value) {
                    showStatus.value = false;
                }
            }, 3000);
        }
    }

    // Always show if disconnected or reconnecting
    if (!newStatus || isReconnecting.value) {
        showStatus.value = true;
    }
};

const forceReconnect = () => {
    console.log('🔌 Manual reconnect triggered');
    socketService.forceReconnect();
};

const toggleDebugInfo = () => {
    showDebugPanel.value = !showDebugPanel.value;
    if (showDebugPanel.value) {
        showStatus.value = true; // Keep status visible when debug panel is open
    }
};

onMounted(() => {
    console.log('🔌 ConnectionStatus component mounted');
    checkConnection();
    checkInterval = setInterval(checkConnection, 1000);
});

onUnmounted(() => {
    if (checkInterval) {
        clearInterval(checkInterval);
    }
});
</script>