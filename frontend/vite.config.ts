import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - generates stats.html
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }) as any,
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 500, // Warn for chunks > 500KB
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React framework
          'vendor-react': ['react', 'react-dom'],

          // Router (separate chunk)
          'vendor-router': ['react-router-dom'],

          // Data fetching & state management
          'vendor-data': ['@tanstack/react-query', 'axios', 'zustand'],

          // UI libraries (heavy animations)
          'vendor-ui': ['framer-motion', 'lucide-react'],

          // Form & validation
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],

          // Radix UI components (many deps)
          'vendor-radix': [
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-tooltip',
          ],

          // EPUB.js and reader dependencies (HEAVY - lazy load candidate)
          // Note: These are NOT in manualChunks because we'll lazy load them
          // 'vendor-epub': ['epubjs', 'react-reader'],

          // Other utilities
          'vendor-utils': [
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
            'dompurify',
            'react-hot-toast',
          ],
        },
      },
    },
    // Enable tree shaking with esbuild (faster than terser)
    minify: 'esbuild',
    // Note: esbuild doesn't have as many options as terser,
    // but it's significantly faster
  },
  // Enable optimizeDeps for faster dev server
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'axios',
      'zustand',
      // ✅ FIX: Include epubjs for proper CommonJS → ESM conversion
      'epubjs',
      '@xmldom/xmldom', // Explicitly include CommonJS dependency
    ],
    // ✅ FIX: Removed exclude - allow Vite to pre-bundle all dependencies
    // This fixes the DOMParser import error from @xmldom/xmldom
  },
})