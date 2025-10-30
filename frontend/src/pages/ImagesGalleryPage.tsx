/**
 * ImagesGalleryPage - Gallery of all AI-generated images
 *
 * Features:
 * - All generated images from all books
 * - Filter by book
 * - Filter by description type (location, character, atmosphere)
 * - Sort options (newest, oldest, book)
 * - Search functionality
 * - Masonry grid layout
 * - Image lightbox/modal
 * - Fully theme-aware (Light/Dark/Sepia)
 * - Responsive design
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Image as ImageIcon,
  Filter,
  Search,
  SortAsc,
  BookOpen,
  MapPin,
  User as UserIcon,
  Sparkles,
  ChevronDown,
  X,
} from 'lucide-react';
import { booksAPI } from '@/api/books';
import { imagesAPI } from '@/api/images';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { cn } from '@/lib/utils';
import type { GeneratedImage } from '@/types/api';

type DescriptionType = 'all' | 'location' | 'character' | 'atmosphere';
type SortOption = 'newest' | 'oldest' | 'book';

interface ImageWithBookInfo extends GeneratedImage {
  book_title: string;
  book_id: string;
}

const ImagesGalleryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<string>('all');
  const [descriptionType, setDescriptionType] = useState<DescriptionType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageWithBookInfo | null>(null);

  // Fetch all books
  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ['books'],
    queryFn: () => booksAPI.getBooks({ skip: 0, limit: 100 }),
  });

  // Fetch images for all books
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['all-images', booksData?.books?.map(b => b.id)],
    queryFn: async () => {
      if (!booksData?.books || booksData.books.length === 0) return [];

      const imagePromises = booksData.books.map(async (book) => {
        try {
          const response = await imagesAPI.getBookImages(book.id, undefined, 0, 100);
          return response.images.map(img => ({
            ...img,
            book_title: book.title,
            book_id: book.id,
          } as ImageWithBookInfo));
        } catch (error) {
          console.error(`Failed to fetch images for book ${book.id}:`, error);
          return [];
        }
      });

      const imageArrays = await Promise.all(imagePromises);
      return imageArrays.flat();
    },
    enabled: !!booksData?.books && booksData.books.length > 0,
  });

  const allImages = imagesData || [];

  const descriptionTypes = [
    { value: 'all', label: 'Все типы', icon: Sparkles },
    { value: 'location', label: 'Локации', icon: MapPin },
    { value: 'character', label: 'Персонажи', icon: UserIcon },
    { value: 'atmosphere', label: 'Атмосфера', icon: Sparkles },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Новые первые' },
    { value: 'oldest', label: 'Старые первые' },
    { value: 'book', label: 'По книгам' },
  ];

  // Filter and sort images
  const filteredImages = useMemo(() => {
    return allImages
      .filter((img) => {
        if (selectedBook !== 'all' && img.book_id !== selectedBook) return false;
        if (descriptionType !== 'all' && img.description?.type !== descriptionType) return false;
        if (searchQuery && !img.description?.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === 'book') return a.book_title.localeCompare(b.book_title);
        return 0;
      });
  }, [allImages, selectedBook, descriptionType, searchQuery, sortBy]);

  const isLoading = booksLoading || imagesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" text="Загрузка изображений..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <ImageIcon className="w-8 h-8" style={{ color: 'var(--accent-color)' }} />
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Галерея изображений
          </h1>
        </div>
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          Все AI-сгенерированные изображения из ваших книг
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div
          className="p-4 rounded-xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Всего изображений
          </p>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {allImages.length}
          </p>
        </div>

        <div
          className="p-4 rounded-xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Локации
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {allImages.filter((img) => img.description?.type === 'location').length}
          </p>
        </div>

        <div
          className="p-4 rounded-xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Персонажи
          </p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {allImages.filter((img) => img.description?.type === 'character').length}
          </p>
        </div>

        <div
          className="p-4 rounded-xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Атмосфера
          </p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {allImages.filter((img) => img.description?.type === 'atmosphere').length}
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div
        className="p-6 rounded-2xl border-2 mb-8"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
        }}
      >
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по описанию..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all"
          style={{
            backgroundColor: showFilters ? 'var(--accent-color)' : 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: showFilters ? 'white' : 'var(--text-primary)',
          }}
        >
          <Filter className="w-4 h-4" />
          <span className="font-medium">Фильтры</span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
        </button>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Book Filter */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Книга
                </label>
                <select
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border-2"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="all">Все книги</option>
                  {booksData?.books?.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Тип описания
                </label>
                <select
                  value={descriptionType}
                  onChange={(e) => setDescriptionType(e.target.value as DescriptionType)}
                  className="w-full px-4 py-2 rounded-lg border-2"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {descriptionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Сортировка
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-4 py-2 rounded-lg border-2"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Найдено изображений: {filteredImages.length}
        </p>
        {(selectedBook !== 'all' || descriptionType !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setSelectedBook('all');
              setDescriptionType('all');
              setSearchQuery('');
            }}
            className="flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          >
            <X className="w-4 h-4" />
            Сбросить фильтры
          </button>
        )}
      </div>

      {/* Gallery Grid */}
      {filteredImages.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <ImageIcon className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Изображений не найдено
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Попробуйте изменить фильтры или загрузите новые книги
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              onClick={() => setSelectedImage(image)}
              className="group cursor-pointer rounded-xl overflow-hidden border-2 transition-all hover:-translate-y-1 hover:shadow-xl"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
              }}
            >
              {/* Image */}
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={image.image_url}
                  alt={image.description?.text || 'Generated image'}
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {image.book_title}
                  </p>
                </div>
                <p className="text-sm line-clamp-2 mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {image.description?.text || image.description?.content}
                </p>
                <span
                  className="inline-block px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {descriptionTypes.find((t) => t.value === image.description?.type)?.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl w-full rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-primary)',
            }}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-lg z-10"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <X className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
            </button>

            <img
              src={selectedImage.image_url}
              alt={selectedImage.description?.text || 'Generated image'}
              className="w-full max-h-[70vh] object-contain"
            />

            <div className="p-6">
              <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                {selectedImage.book_title}
              </h3>
              <p className="text-lg mb-4" style={{ color: 'var(--text-secondary)' }}>
                {selectedImage.description?.text || selectedImage.description?.content}
              </p>
              <div className="flex items-center gap-3">
                <span
                  className="px-3 py-1 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'white',
                  }}
                >
                  {descriptionTypes.find((t) => t.value === selectedImage.description?.type)?.label}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(selectedImage.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagesGalleryPage;
