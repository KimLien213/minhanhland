<template>
    <Transition name="loading">
        <div v-if="isLoading" class="loading-overlay" @click.stop>
            <div class="loading-box">
                <div class="spinner"></div>
                <p>Đang xử lý...</p>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { useLoadingStore } from '@/stores/loadingStore';

const { isLoading } = useLoadingStore();
</script>

<style scoped>
.loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: wait;
}

.loading-box {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    text-align: center;
    min-width: 200px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.loading-box p {
    margin: 0;
    color: #374151;
    font-weight: 500;
}

/* Smooth transitions */
.loading-enter-active,
.loading-leave-active {
    transition: all 0.2s ease;
}

.loading-enter-from {
    opacity: 0;
    backdrop-filter: blur(0px);
}

.loading-enter-to {
    opacity: 1;
    backdrop-filter: blur(2px);
}

.loading-leave-from {
    opacity: 1;
}

.loading-leave-to {
    opacity: 0;
}

.loading-enter-active .loading-box,
.loading-leave-active .loading-box {
    transition: transform 0.2s ease;
}

.loading-enter-from .loading-box {
    transform: scale(0.9) translateY(-20px);
}

.loading-leave-to .loading-box {
    transform: scale(0.9) translateY(-20px);
}
</style>