import React, { useState, useRef } from 'react';
import { X, Upload, BookOpen, FileText, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { useUIStore } from '@/stores/ui';
import { useTranslation } from '@/hooks/useTranslation';
import { STORAGE_KEYS } from '@/types/state';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

interface BookUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void;
}

interface FileWithPreview extends File {
  preview?: {
    title?: string;
    author?: string;
    format: string;
    size: string;
  };
}

const SUPPORTED_FORMATS = ['.epub', '.fb2'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const BookUploadModal: React.FC<BookUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { notify } = useUIStore();
  const { t } = useTranslation();

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Проверяем файл
      console.log('Upload mutation called with file:', file);
      
      if (!file) {
        throw new Error('No file provided to upload mutation');
      }
      
      console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Проверяем FormData
      console.log('FormData entries:');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }
      
      // Debug код временно удален для чистого тестирования
      
      return booksAPI.uploadBook(formData, {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: progress,
          }));
        },
      });
    },
    onSuccess: (data, file) => {
      notify.success(t('upload.uploadComplete'), t('upload.uploadSuccess').replace('{title}', data.title));
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[file.name];
        return newProgress;
      });
      setFiles(prev => prev.filter(f => f.name !== file.name));

      // Invalidate books query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['books'] });

      // Call the success callback if provided
      if (onUploadSuccess) {
        onUploadSuccess();
      }

      // Парсинг автоматически запускается на backend после загрузки
      if (data.is_processing) {
        notify.info(t('upload.processingStarted'), t('upload.analyzingContent').replace('{title}', data.title));
      }
    },
    onError: (error: any, file) => {
      notify.error(t('upload.uploadFailed'), error.message || t('upload.uploadFailedDesc'));
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[file.name];
        return newProgress;
      });
    },
  });

  // File validation
  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!SUPPORTED_FORMATS.includes(extension)) {
      return t('upload.unsupportedFormat').replace('{formats}', SUPPORTED_FORMATS.join(', '));
    }

    if (file.size > MAX_FILE_SIZE) {
      return t('upload.fileTooLargeDesc').replace('{size}', String(MAX_FILE_SIZE / (1024 * 1024)));
    }

    return null;
  };

  // Generate file preview
  const generatePreview = async (file: File): Promise<FileWithPreview> => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    
    // Создаем новый File объект и добавляем preview свойство
    const fileWithPreview = Object.assign(file, {
      preview: {
        title: file.name.replace(/\.(epub|fb2)$/i, ''),
        format: extension.toUpperCase().slice(1),
        size: sizeFormatted,
      },
    } as FileWithPreview);
    
    return fileWithPreview;
  };

  // Handle file selection
  const handleFiles = async (fileList: FileList) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    // Show validation errors
    if (errors.length > 0) {
      notify.error(t('upload.fileValidationFailed'), errors.join('\n'));
    }

    // Process valid files
    if (validFiles.length > 0) {
      const filesWithPreviews = await Promise.all(
        validFiles.map(generatePreview)
      );
      setFiles(prev => [...prev, ...filesWithPreviews]);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  };

  // File input handler
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      handleFiles(selectedFiles);
    }
  };

  // Upload selected files
  const startUpload = () => {
    files.forEach(file => {
      // File с preview свойством все еще является File объектом
      uploadMutation.mutate(file);
    });
  };

  // Remove file from list
  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
  };

  // Close modal and reset state
  const handleClose = () => {
    if (uploadMutation.isPending) {
      notify.warning(t('upload.uploadInProgress'), t('upload.uploadInProgressDesc'));
      return;
    }
    setFiles([]);
    setUploadProgress({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-6 w-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('upload.uploadBooks')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
              disabled={uploadMutation.isPending}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Drag and Drop Area */}
            {files.length === 0 && (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('upload.dragDropHere')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t('upload.orClickBrowse')}
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t('upload.chooseFiles')}
                </button>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  {t('upload.supports')}: {SUPPORTED_FORMATS.join(', ')} • {t('upload.maxSizeLabel')}: {MAX_FILE_SIZE / (1024 * 1024)}MB
                </p>
              </div>
            )}

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-3">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-primary-600 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {file.preview?.title || file.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {file.preview?.format} • {file.preview?.size}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {uploadProgress[file.name] !== undefined ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div
                                className="bg-primary-600 h-2 rounded-full transition-all"
                                style={{
                                  width: `${uploadProgress[file.name]}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                              {uploadProgress[file.name]}%
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => removeFile(file.name)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Upload Button */}
                <div className="flex justify-between items-center pt-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    {t('upload.addMoreFiles')}
                  </button>

                  <button
                    onClick={startUpload}
                    disabled={uploadMutation.isPending || files.length === 0}
                    className="inline-flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        {t('upload.uploadingFiles')}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {files.length === 1 ? t('upload.uploadCountOne') : t('upload.uploadCount').replace('{count}', String(files.length))}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-800 dark:text-blue-200 font-medium mb-1">
                    {t('upload.processingInfo')}
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                    {t('upload.processingInfoItems').map((item: string, index: number) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={SUPPORTED_FORMATS.join(',')}
            onChange={handleFileInput}
            className="hidden"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};