<script setup>
import { setToastInstance } from '@/plugin/toast';
import { useToast } from 'primevue/usetoast';

const toast = useToast();
setToastInstance(toast);
</script>
<template>
    <router-view />
</template>

<style scoped></style>
