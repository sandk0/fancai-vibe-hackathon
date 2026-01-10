/**
 * PositionConflictDialog - Dialog for resolving reading position conflicts
 *
 * Shown when there's a significant difference (>5%) between local and server
 * reading positions, allowing the user to choose which position to continue from.
 *
 * @component
 */

import React, { useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Z_INDEX } from '@/lib/zIndex';

interface PositionConflictDialogProps {
  isOpen: boolean;
  serverPosition: {
    cfi: string;
    progress: number;
    lastReadAt: Date;
  };
  localPosition: {
    cfi: string;
    progress: number;
    savedAt: Date;
  };
  onUseServer: () => void;
  onUseLocal: () => void;
}

/**
 * Format a date as relative time in Russian
 * Simple implementation without date-fns dependency
 */
function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'только что';
  }
  if (diffMinutes < 60) {
    if (diffMinutes === 1) return '1 минуту';
    if (diffMinutes < 5) return `${diffMinutes} минуты`;
    return `${diffMinutes} минут`;
  }
  if (diffHours < 24) {
    if (diffHours === 1) return '1 час';
    if (diffHours < 5) return `${diffHours} часа`;
    return `${diffHours} часов`;
  }
  if (diffDays === 1) return '1 день';
  if (diffDays < 5) return `${diffDays} дня`;
  return `${diffDays} дней`;
}

export const PositionConflictDialog: React.FC<PositionConflictDialogProps> = ({
  isOpen,
  serverPosition,
  localPosition,
  onUseServer,
  onUseLocal,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Enable focus trap when dialog is open
  useFocusTrap(isOpen, dialogRef);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: Z_INDEX.modal }}
    >
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        style={{ zIndex: Z_INDEX.modalOverlay }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="position-conflict-title"
        className="relative bg-popover rounded-xl p-6 max-w-md mx-4 shadow-xl pointer-events-auto"
        style={{ zIndex: Z_INDEX.modal }}
      >
        <h3
          id="position-conflict-title"
          className="text-lg font-semibold text-popover-foreground mb-4"
        >
          Обнаружена разница в позициях чтения
        </h3>

        <p className="text-muted-foreground text-sm mb-4">
          Вы читали эту книгу на другом устройстве. Выберите, с какой позиции продолжить.
        </p>

        <div className="space-y-3 mb-6">
          {/* Server position */}
          <div className="p-3 bg-muted rounded">
            <div className="text-sm text-muted-foreground">Другое устройство</div>
            <div className="text-popover-foreground text-lg font-medium">
              {Math.round(serverPosition.progress)}%
            </div>
            <div className="text-xs text-muted-foreground/70">
              {formatDistanceToNow(serverPosition.lastReadAt)} назад
            </div>
          </div>

          {/* Local position */}
          <div className="p-3 bg-muted rounded">
            <div className="text-sm text-muted-foreground">Это устройство</div>
            <div className="text-popover-foreground text-lg font-medium">
              {Math.round(localPosition.progress)}%
            </div>
            <div className="text-xs text-muted-foreground/70">
              {formatDistanceToNow(localPosition.savedAt)} назад
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onUseServer}
            className="flex-1 px-4 py-2.5 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-popover"
          >
            Продолжить с {Math.round(serverPosition.progress)}%
          </button>
          <button
            onClick={onUseLocal}
            className="flex-1 px-4 py-2.5 min-h-[44px] bg-muted hover:bg-accent text-popover-foreground font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-popover"
          >
            Остаться на {Math.round(localPosition.progress)}%
          </button>
        </div>
      </div>
    </div>
  );
};
