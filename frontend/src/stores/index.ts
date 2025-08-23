// Main store exports

export { useAuthStore } from './auth';
export { useBooksStore } from './books';
export { useImagesStore } from './images';
export { useReaderStore } from './reader';
export { useUIStore, notify } from './ui';

// Store initialization function
export const initializeStores = () => {
  // Load auth data from storage
  useAuthStore.getState().loadUserFromStorage();
  
  // Apply saved theme
  const theme = localStorage.getItem('bookreader_theme') || 'light';
  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'sepia');
  root.classList.add(theme);
};