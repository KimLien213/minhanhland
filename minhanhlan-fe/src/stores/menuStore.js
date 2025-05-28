import { defineStore } from 'pinia';

export const useMenuStore = defineStore('menu', {
  state: () => ({
    defaultProductRoute: localStorage.getItem('defaultProductRoute') || null
  }),
  actions: {
    setDefaultProductRoute(path) {
      this.defaultProductRoute = path;
      localStorage.setItem('defaultProductRoute', path); // ✅ persist
    }
  }
});
