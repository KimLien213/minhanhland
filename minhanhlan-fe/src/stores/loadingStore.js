import { ref } from 'vue'

const isLoading = ref(false)
let requestCount = 0

export const useLoadingStore = () => {
  const startLoading = () => {
    requestCount++
    isLoading.value = true
  }

  const stopLoading = () => {
    requestCount = Math.max(0, requestCount - 1)
    if (requestCount === 0) {
      // Delay nhỏ để tránh loading nhấp nháy
      setTimeout(() => {
        if (requestCount === 0) {
          isLoading.value = false
        }
      }, 100)
    }
  }

  return {
    isLoading,
    startLoading,
    stopLoading
  }
}