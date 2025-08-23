// UI State Store

import { create } from 'zustand';
import type { UIState, Notification } from '@/types/state';

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  isLoading: false,
  loadingMessage: '',
  sidebarOpen: false,
  mobileMenuOpen: false,
  
  // Modals
  showUploadModal: false,
  showSettingsModal: false,
  showImageModal: false,
  showProfileModal: false,
  currentImageModal: null,
  
  // Notifications
  notifications: [],

  // Actions
  setLoading: (loading, message = '') => {
    set({ isLoading: loading, loadingMessage: message });
  },

  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },

  setMobileMenuOpen: (open) => {
    set({ mobileMenuOpen: open });
    
    // Close sidebar when mobile menu opens
    if (open) {
      set({ sidebarOpen: false });
    }
  },

  setShowUploadModal: (show) => {
    set({ showUploadModal: show });
  },

  setShowSettingsModal: (show) => {
    set({ showSettingsModal: show });
  },

  setShowImageModal: (show, image = null) => {
    set({ showImageModal: show, currentImageModal: image });
  },

  setShowProfileModal: (show) => {
    set({ showProfileModal: show });
  },

  addNotification: (notificationData) => {
    const notification: Notification = {
      id: `notification-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      duration: 5000, // Default 5 seconds
      ...notificationData,
    };

    set({ notifications: [notification, ...get().notifications] });

    // Auto-dismiss after duration
    if (notification.duration) {
      setTimeout(() => {
        get().removeNotification(notification.id);
      }, notification.duration);
    }
  },

  removeNotification: (id) => {
    set({ 
      notifications: get().notifications.filter(n => n.id !== id) 
    });
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
}));

// Utility functions for common notification types
export const notify = {
  success: (title: string, message?: string) => {
    useUIStore.getState().addNotification({
      type: 'success',
      title,
      message,
    });
  },

  error: (title: string, message?: string) => {
    useUIStore.getState().addNotification({
      type: 'error',
      title,
      message,
      duration: 10000, // Longer duration for errors
    });
  },

  warning: (title: string, message?: string) => {
    useUIStore.getState().addNotification({
      type: 'warning',
      title,
      message,
      duration: 7000,
    });
  },

  info: (title: string, message?: string) => {
    useUIStore.getState().addNotification({
      type: 'info',
      title,
      message,
    });
  },

  loading: (title: string, message?: string) => {
    const { setLoading, addNotification } = useUIStore.getState();
    setLoading(true, message);
    addNotification({
      type: 'info',
      title,
      message,
      duration: undefined, // Persistent until manually removed
    });
  },

  stopLoading: () => {
    useUIStore.getState().setLoading(false);
  },
};