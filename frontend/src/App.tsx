import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Store initialization
import { initializeStores } from '@/stores';

// Layout components
import Layout from '@/components/Layout/Layout';
import AuthGuard from '@/components/Auth/AuthGuard';

// Pages
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import LibraryPage from '@/pages/LibraryPage';
import BookPage from '@/pages/BookPage';
import BookImagesPage from '@/pages/BookImagesPage';
import BookReaderPage from '@/pages/BookReaderPage';
import ChapterPage from '@/pages/ChapterPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
import AdminDashboard from '@/pages/AdminDashboardEnhanced';
import NotFoundPage from '@/pages/NotFoundPage';

// Global styles
import '@/styles/globals.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

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
        <div className="App min-h-screen bg-gray-50 dark:bg-gray-900">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Fullscreen reader route (no layout) */}
            <Route
              path="/book/:bookId/read"
              element={
                <AuthGuard>
                  <BookReaderPage />
                </AuthGuard>
              }
            />

            {/* Protected routes with layout */}
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/library" element={<LibraryPage />} />
                      <Route path="/book/:bookId" element={<BookPage />} />
                      <Route path="/book/:bookId/images" element={<BookImagesPage />} />
                      <Route
                        path="/book/:bookId/chapter/:chapterNumber"
                        element={<ChapterPage />}
                      />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
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