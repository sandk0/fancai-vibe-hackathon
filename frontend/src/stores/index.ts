// Store imports for initialization
import { useAuthStore as _useAuthStore } from './auth';

// Main store exports
export { useAuthStore } from './auth';
export { useBooksStore } from './books';
export { useImagesStore } from './images';
export { useReaderStore } from './reader';
export { useUIStore, notify } from './ui';

// Store initialization function
export const initializeStores = () => {
  // Apply saved theme
  try {
    const theme = localStorage.getItem('bookreader_theme') || 'light';
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'sepia');
    root.classList.add(theme);
  } catch (error) {
    console.warn('Failed to initialize theme:', error);
  }
  
  // Load auth data from storage (lazy initialization)
  setTimeout(() => {
    try {
      console.log('🚀 Initializing auth store...');
      _useAuthStore.getState().loadUserFromStorage();
    } catch (error) {
      console.warn('Failed to initialize auth store:', error);
    }
  }, 0);
};