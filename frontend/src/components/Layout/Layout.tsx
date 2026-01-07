import React from 'react';
import { useUIStore } from '@/stores/ui';
import { useAutoWebSocket } from '@/services/websocket';
import Header from './Header';
import Sidebar from './Sidebar';
import { BottomNav } from '@/components/Navigation/BottomNav';
import NotificationContainer from '@/components/UI/NotificationContainer';
import { BookUploadModal } from '@/components/Books/BookUploadModal';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { sidebarOpen, mobileMenuOpen, showUploadModal, setSidebarOpen, setMobileMenuOpen, setShowUploadModal } = useUIStore();

  // Auto-connect WebSocket for real-time updates
  useAutoWebSocket();

  // Close mobile menu when clicking outside
  const handleBackdropClick = () => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen transition-colors bg-background text-foreground">
      {/* Skip Link for Keyboard Navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[900] focus:top-4 focus:left-4 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Перейти к основному контенту
      </a>

      {/* Header */}
      <Header />

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Mobile overlay */}
        {(sidebarOpen || mobileMenuOpen) && (
          <div
            className="fixed inset-0 z-[400] bg-black bg-opacity-50 lg:hidden"
            onClick={handleBackdropClick}
          />
        )}

        {/* Main Content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 min-h-screen pt-16 pb-20 md:pb-0 bg-muted outline-none"
        >
          {children}
        </main>
      </div>

      {/* Bottom navigation for mobile */}
      <BottomNav />

      {/* Global Notifications */}
      <NotificationContainer />

      {/* Upload Modal */}
      <BookUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  );
};

export default Layout;