import React from 'react';
import { useUIStore } from '@/stores/ui';
import { useAutoWebSocket } from '@/services/websocket';
import Header from './Header';
import Sidebar from './Sidebar';
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
      {/* Header */}
      <Header />

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Mobile overlay */}
        {(sidebarOpen || mobileMenuOpen) && (
          <div
            className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
            onClick={handleBackdropClick}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen pt-16 bg-muted">
          <div className="container mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>

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