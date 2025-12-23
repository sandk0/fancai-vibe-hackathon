import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Shared queryClient for cache management
import { queryClient } from '@/lib/queryClient';

// Store initialization
import { initializeStores } from '@/stores';

// Layout components (always loaded)
import Layout from '@/components/Layout/Layout';
import AuthGuard from '@/components/Auth/AuthGuard';

// Core pages (eagerly loaded - small and frequently accessed)
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import LibraryPage from '@/pages/LibraryPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Lazy-loaded pages (heavy or less frequently accessed)
// These will be code-split into separate chunks
const BookPage = lazy(() => import('@/pages/BookPage'));
const BookImagesPage = lazy(() => import('@/pages/BookImagesPage'));
const ImagesGalleryPage = lazy(() => import('@/pages/ImagesGalleryPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const ChapterPage = lazy(() => import('@/pages/ChapterPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

// Heavy pages with large dependencies (CRITICAL for bundle size)
// BookReaderPage includes EpubReader which loads epub.js (~300KB)
const BookReaderPage = lazy(() => import('@/pages/BookReaderPage'));

// Admin dashboard (large component, admin-only)
const AdminDashboard = lazy(() => import('@/pages/AdminDashboardEnhanced'));

// Global styles with theme support
import '@/styles/globals.css';

/**
 * Loading fallback component
 * Shown while lazy-loaded chunks are being fetched
 */
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen" style={{
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  }}>
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-gray-400">Загрузка...</p>
    </div>
  </div>
);

function App() {
  useEffect(() => {
    // Initialize stores when app starts
    console.log('🚀 App starting, initializing stores...');
    try {
      initializeStores();
      console.log('✅ Stores initialized successfully');
    } catch (error) {
      console.warn('❌ Failed to initialize stores:', error);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App min-h-screen transition-colors" style={{
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Fullscreen reader route (no layout) */}
            <Route
              path="/book/:bookId/read"
              element={
                <AuthGuard>
                  <Suspense fallback={<PageLoadingFallback />}>
                    <BookReaderPage />
                  </Suspense>
                </AuthGuard>
              }
            />

            {/* Protected routes with layout */}
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <Layout>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/library" element={<LibraryPage />} />
                        <Route path="/book/:bookId" element={<BookPage />} />
                        <Route path="/book/:bookId/images" element={<BookImagesPage />} />
                        <Route path="/images" element={<ImagesGalleryPage />} />
                        <Route path="/stats" element={<StatsPage />} />
                        <Route
                          path="/book/:bookId/chapter/:chapterNumber"
                          element={<ChapterPage />}
                        />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/admin" element={<AdminDashboard />} />
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </AuthGuard>
              }
            />
          </Routes>
          
          {/* Global notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#22c55e',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;