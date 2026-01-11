/**
 * StorageQuotaInfo - Component for displaying storage usage information
 *
 * Shows storage usage progress bar, used/total space, warnings when storage
 * is running low, and provides a button to clear cache.
 *
 * @module components/Settings/StorageQuotaInfo
 */

import React, { useState } from 'react';
import { HardDrive, Trash2, AlertTriangle, RefreshCw, Database, Image, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/UI/Card';
import { Progress } from '@/components/UI/progress';
import { Button } from '@/components/UI/button';
import { ConfirmDialog } from '@/components/UI/Dialog';
import {
  useStorageInfo,
  useStorageBreakdown,
  useClearOfflineData,
  formatBytes,
} from '@/hooks/useStorageInfo';

export interface StorageQuotaInfoProps {
  /** Additional CSS classes */
  className?: string;
  /** Show detailed breakdown by data type */
  showBreakdown?: boolean;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * StorageQuotaInfo displays current storage usage with visual feedback
 *
 * Features:
 * - Progress bar showing usage percentage
 * - "Использовано: X MB из Y MB" display
 * - Warning at >80% usage
 * - Critical warning at >95% usage
 * - "Очистить кэш" button with confirmation dialog
 * - Optional breakdown by data type (chapters, images, etc.)
 */
export const StorageQuotaInfo: React.FC<StorageQuotaInfoProps> = ({
  className,
  showBreakdown = false,
  compact = false,
}) => {
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Hooks for storage data
  const { data: storageInfo, isLoading, refetch, isRefetching } = useStorageInfo();
  const { data: breakdown } = useStorageBreakdown();
  const { mutate: clearOfflineData, isPending: isClearingData } = useClearOfflineData();

  // Handle clear cache action
  const handleClearCache = () => {
    clearOfflineData(undefined, {
      onSuccess: () => {
        setShowClearDialog(false);
      },
    });
  };

  // Get progress bar color based on usage level
  const getProgressColor = (): string => {
    if (!storageInfo) return '';
    if (storageInfo.isCritical) return '[&>div]:bg-red-500';
    if (storageInfo.isWarning) return '[&>div]:bg-yellow-500';
    return '[&>div]:bg-green-500';
  };

  // Render loading skeleton
  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)} padding={compact ? 'sm' : 'md'}>
        <div className="space-y-3">
          <div className="h-4 w-1/3 bg-muted rounded" />
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={className} padding={compact ? 'sm' : 'md'}>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className={cn('text-muted-foreground', compact ? 'w-4 h-4' : 'w-5 h-5')} />
              <CardTitle className={compact ? 'text-base' : ''}>Хранилище</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-8 w-8 p-0"
              title="Обновить"
            >
              <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin')} />
            </Button>
          </div>
          {!compact && storageInfo && (
            <CardDescription>
              Данные для офлайн-чтения
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className={compact ? 'pt-2' : ''}>
          <div className="space-y-4">
            {/* Usage text and progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Использовано:</span>
                {storageInfo ? (
                  <span className="font-medium text-foreground">
                    {formatBytes(storageInfo.used)} из {formatBytes(storageInfo.quota)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Недоступно</span>
                )}
              </div>

              {storageInfo && (
                <Progress
                  value={storageInfo.percentUsed}
                  className={cn('h-2', getProgressColor())}
                />
              )}

              {storageInfo && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{storageInfo.percentUsed.toFixed(1)}% занято</span>
                  <span>Свободно: {formatBytes(storageInfo.available)}</span>
                </div>
              )}
            </div>

            {/* Warning messages */}
            {storageInfo?.isCritical && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-100 dark:bg-red-950 border border-red-200 dark:border-red-900">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    Критически мало места!
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                    Удалите неиспользуемые книги для освобождения пространства.
                  </p>
                </div>
              </div>
            )}

            {storageInfo?.isWarning && !storageInfo.isCritical && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-100 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-900">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                    Заканчивается место
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                    Рекомендуется очистить неиспользуемые данные.
                  </p>
                </div>
              </div>
            )}

            {/* Storage breakdown */}
            {showBreakdown && breakdown && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Разбивка по типам
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Главы</p>
                      <p className="text-sm font-medium text-foreground">{formatBytes(breakdown.chapters)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Image className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Изображения</p>
                      <p className="text-sm font-medium text-foreground">{formatBytes(breakdown.images)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Database className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Прогресс</p>
                      <p className="text-sm font-medium text-foreground">{formatBytes(breakdown.readingProgress)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <RefreshCw className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Синхронизация</p>
                      <p className="text-sm font-medium text-foreground">{formatBytes(breakdown.syncQueue)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Statistics */}
            {!compact && storageInfo && (
              <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                <span>Глав: {storageInfo.chaptersCount}</span>
                <span>Изображений: {storageInfo.imagesCount}</span>
                <span>Книг: {storageInfo.offlineBooksCount}</span>
              </div>
            )}

            {/* Clear cache button */}
            <Button
              variant={storageInfo?.isCritical ? 'destructive' : 'secondary'}
              size={compact ? 'sm' : 'md'}
              className="w-full"
              onClick={() => setShowClearDialog(true)}
              disabled={isClearingData}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Очистить кэш
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <ConfirmDialog
        isOpen={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        title="Очистить офлайн-данные?"
        description="Все скачанные книги, изображения и кэшированные данные будут удалены. Это действие нельзя отменить. Прогресс чтения сохранится на сервере."
        confirmText="Очистить"
        cancelText="Отмена"
        destructive
        onConfirm={handleClearCache}
        isLoading={isClearingData}
      />
    </>
  );
};

export default StorageQuotaInfo;
