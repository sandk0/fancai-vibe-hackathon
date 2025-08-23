// Main API exports

export { apiClient as default } from './client';
export { authAPI } from './auth';
export { booksAPI } from './books';
export { imagesAPI } from './images';

// Re-export client for direct usage
export { apiClient } from './client';