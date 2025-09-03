import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { booksAPI } from '@/api/books';

interface ParsingOverlayProps {
  bookId: string;
  onParsingComplete?: () => void;
  forceBlock?: boolean;
}

export const ParsingOverlay: React.FC<ParsingOverlayProps> = ({ 
  bookId, 
  onParsingComplete,
  forceBlock = false 
}) => {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const checkProgress = async () => {
      try {
        const status = await booksAPI.getParsingStatus(bookId);
        console.log(`[ParsingOverlay] API response for ${bookId}:`, status);
        
        // Обновляем прогресс
        const currentProgress = status.progress || 0;
        console.log(`[ParsingOverlay] Updating progress: ${progress}% -> ${currentProgress}%`);
        setProgress(currentProgress);
        setIsProcessing(status.status === 'processing' || status.status === 'queued');
        
        if (status.status === 'completed' || currentProgress >= 100) {
          setIsComplete(true);
          setProgress(100);
          if (onParsingComplete) {
            setTimeout(onParsingComplete, 1000);
          }
        } else if (status.status === 'not_started') {
          // Если еще не запущен, ждем автоматического запуска с backend
          // Показываем 0% и продолжаем проверку чаще
          setProgress(0);
          intervalId = setTimeout(checkProgress, 500);
        } else {
          // Продолжаем проверку прогресса чаще для лучшего UX
          intervalId = setTimeout(checkProgress, 300);
        }
      } catch (error) {
        console.error('Failed to check progress:', error);
        // Повторяем попытку через некоторое время
        intervalId = setTimeout(checkProgress, 1000);
      }
    };

    // Начинаем проверку прогресса сразу
    checkProgress();

    return () => {
      if (intervalId) clearTimeout(intervalId);
    };
  }, [bookId, onParsingComplete]);

  // Скрываем overlay если парсинг завершен
  if (isComplete && !forceBlock) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg"
    >
      {/* Круговой прогресс */}
      <div className="relative">
        {/* Фон круга */}
        <svg className="w-20 h-20 transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="8"
            fill="none"
          />
          {/* Прогресс */}
          <motion.circle
            cx="40"
            cy="40"
            r="36"
            stroke="white"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={226.2} // 2 * PI * r
            initial={{ strokeDashoffset: 226.2 }}
            animate={{ 
              strokeDashoffset: 226.2 - (226.2 * progress) / 100
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </svg>
        
        {/* Процент в центре */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-lg">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
};