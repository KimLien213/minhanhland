// src/stores/menuStore.js - Enhanced to store menu data
import { defineStore } from 'pinia';

export const useMenuStore = defineStore('menu', {
  state: () => ({
    defaultProductRoute: localStorage.getItem('defaultProductRoute') || null,
    menuData: JSON.parse(localStorage.getItem('menuData') || '[]'), // Store menu data
  }),

  actions: {
    setDefaultProductRoute(path) {
      this.defaultProductRoute = path;
      localStorage.setItem('defaultProductRoute', path);
    },

    // New action to store menu data
    setMenuData(data) {
      this.menuData = data;
      localStorage.setItem('menuData', JSON.stringify(data));
    },

    // Helper to find subdivision and apartment type info
    getPageInfo(subdivisionId, apartmentTypeId) {
      let subdivisionName = '';
      let apartmentTypeName = '';

      const subdivisionItem = this.menuData.find(item => item.id === subdivisionId);
      if (subdivisionItem) {
        subdivisionName = subdivisionItem.name;

        if (subdivisionItem.children) {
          const apartmentTypeItem = subdivisionItem.children.find(
            child => child.id === apartmentTypeId
          );
          if (apartmentTypeItem) {
            apartmentTypeName = apartmentTypeItem.name;
          }
        }
      }

      return {
        subdivisionName: subdivisionName || 'N/A',
        apartmentTypeName: apartmentTypeName || 'N/A'
      };
    },

    // Clear all stored data
    clearMenuData() {
      this.menuData = [];
      this.defaultProductRoute = null;
      localStorage.removeItem('menuData');
      localStorage.removeItem('defaultProductRoute');
    }
  }
});