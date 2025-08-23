import React from 'react';
import { cn } from '@/utils/cn';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  color?: 'primary' | 'secondary' | 'white';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  className,
  color = 'primary',
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  };

  const colorClasses = {
    primary: 'border-primary-200 border-t-primary-600',
    secondary: 'border-gray-200 border-t-gray-600',
    white: 'border-white/20 border-t-white',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;