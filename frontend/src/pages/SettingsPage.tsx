/**
 * SettingsPage - Modern redesign with shadcn UI components
 *
 * Features:
 * - Tab-based navigation with icons
 * - Account settings
 * - Notification preferences
 * - Privacy & security
 * - About section
 * - PWA settings (installation, storage, notifications)
 * - Fully theme-aware (Light/Dark/Sepia)
 * - Responsive sidebar
 *
 * Note: Reader settings (theme, font, size) are available in the reader controls
 */

import React, { useState } from 'react';
import {
  User,
  Bell,
  Shield,
  Info,
  Check,
  Smartphone,
  HardDrive,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  BellRing,
  Book,
} from 'lucide-react';
import { StorageQuotaInfo } from '@/components/Settings/StorageQuotaInfo';
import { useAuthStore } from '@/stores/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Accordion, type AccordionItem } from '@/components/UI/Accordion';
import { Button } from '@/components/UI/button';
import { Progress } from '@/components/UI/progress';
import { ConfirmDialog } from '@/components/UI/Dialog';
import { IOSInstallInstructions, IOSPushGuidance, useIOSPushReadiness } from '@/components/UI/IOSInstallInstructions';

// PWA Hooks
import { useStorageInfo, useRequestPersistence, useClearOfflineData, formatBytes } from '@/hooks/useStorageInfo';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useOfflineBooks } from '@/hooks/useOfflineBook';

type SettingsTab = 'account' | 'notifications' | 'privacy' | 'pwa' | 'about';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, description }) => {
  const switchId = React.useId();
  const descriptionId = `${switchId}-description`;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex-1 min-w-0">
        <label
          id={switchId}
          className="text-sm font-medium text-foreground cursor-pointer break-words"
        >
          {label}
        </label>
        <p id={descriptionId} className="text-xs mt-0.5 text-muted-foreground break-words">
          {description}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-labelledby={switchId}
        aria-describedby={descriptionId}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={cn(
          'relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          checked ? 'bg-green-500' : 'bg-zinc-600'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const { user } = useAuthStore();
  const { t } = useTranslation();

  // Notification settings state
  const [bookProcessing, setBookProcessing] = useState(true);
  const [imageGeneration, setImageGeneration] = useState(true);
  const [readingReminders, setReadingReminders] = useState(false);

  // PWA settings state
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);

  // PWA Hooks
  const { data: storageInfo } = useStorageInfo();
  const { mutate: requestPersistence, isPending: isRequestingPersistence } = useRequestPersistence();
  const { mutate: clearOfflineData, isPending: isClearingData } = useClearOfflineData();
  const { offlineBooks } = useOfflineBooks();

  const {
    isSupported: isPushSupported,
    canUsePush,
    unavailableReason,
    permissionState,
    isSubscribed,
    isLoading: isPushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    testNotification,
  } = usePushNotifications();

  const {
    isInstallable,
    isInstalled,
    isInstalling,
    isIOSDevice,
    install,
  } = usePWAInstall();

  // iOS Push readiness state
  const { needsGuidance: needsIOSPushGuidance } = useIOSPushReadiness();

  // Handle clear offline data
  const handleClearOfflineData = () => {
    clearOfflineData(undefined, {
      onSuccess: () => {
        setShowClearDataDialog(false);
      },
    });
  };

  const tabs = [
    {
      id: 'account' as SettingsTab,
      label: 'Аккаунт',
      icon: User,
      description: 'Профиль и настройки подписки'
    },
    {
      id: 'notifications' as SettingsTab,
      label: t('settings.notifications'),
      icon: Bell,
      description: 'Настройки уведомлений'
    },
    {
      id: 'privacy' as SettingsTab,
      label: t('settings.privacy'),
      icon: Shield,
      description: 'Конфиденциальность и безопасность'
    },
    {
      id: 'pwa' as SettingsTab,
      label: 'Приложение',
      icon: Smartphone,
      description: 'Установка, хранилище и уведомления'
    },
    {
      id: 'about' as SettingsTab,
      label: 'О программе',
      icon: Info,
      description: 'Версия приложения и информация'
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground">
                {t('profile.personalInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">
                    {t('profile.fullName')}
                  </label>
                  <input
                    type="text"
                    value={user?.full_name || ''}
                    className="w-full px-4 py-3 min-h-[44px] rounded-xl border-2 bg-muted border-border text-foreground"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">
                    {t('profile.email')}
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="w-full px-4 py-3 min-h-[44px] rounded-xl border-2 bg-muted border-border text-foreground"
                    readOnly
                  />
                </div>
              </div>
              <div className="mt-6 p-4 rounded-xl border-2 bg-muted border-border">
                <p className="text-sm text-muted-foreground">
                  Настройки аккаунта доступны только для чтения. Свяжитесь с поддержкой для изменений.
                </p>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            {/* iOS Push Guidance - shows only for iOS Safari users not in PWA mode */}
            {needsIOSPushGuidance && (
              <IOSPushGuidance expanded className="mb-2" />
            )}

            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground">
                Настройки уведомлений
              </h3>
              <div className="space-y-2">
                <ToggleSwitch
                  checked={bookProcessing}
                  onChange={setBookProcessing}
                  label="Обработка книги"
                  description="Получать уведомление когда обработка книги завершена"
                />
                <div className="h-px bg-border" />

                <ToggleSwitch
                  checked={imageGeneration}
                  onChange={setImageGeneration}
                  label="Генерация изображений"
                  description="Получать уведомление когда создаются новые изображения"
                />
                <div className="h-px bg-border" />

                <ToggleSwitch
                  checked={readingReminders}
                  onChange={setReadingReminders}
                  label="Напоминания о чтении"
                  description="Получать напоминания продолжить чтение"
                />
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6 max-w-full overflow-hidden">
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground break-words">
                Конфиденциальность и безопасность
              </h3>
              <div className="space-y-6">
                {/* Info Box */}
                <div className="p-4 sm:p-6 rounded-xl border-2 bg-muted border-primary">
                  <div className="flex items-start gap-3">
                    <Shield className="w-6 h-6 flex-shrink-0 mt-0.5 text-primary" />
                    <p className="text-foreground break-words min-w-0">
                      Ваши книги и данные чтения хранятся безопасно и не передаются третьим лицам.
                    </p>
                  </div>
                </div>

                {/* Data Collection */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">
                    Сбор данных
                  </h4>
                  <div className="space-y-2">
                    {[
                      'Прогресс чтения и закладки',
                      'Сгенерированные изображения из ваших книг',
                      'Статистика использования приложения (анонимизированная)',
                    ].map((item, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
                        <span className="text-sm text-muted-foreground break-words min-w-0">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'pwa':
        return (
          <div className="space-y-8 max-w-full overflow-hidden">
            {/* Section 1: App Installation */}
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground break-words">
                Установка приложения
              </h3>
              <div className="space-y-4">
                {isInstalled ? (
                  // App is installed
                  <div className="p-4 sm:p-6 rounded-xl border-2 bg-green-50 dark:bg-green-950 border-green-500">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 flex-shrink-0 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="font-semibold text-green-700 dark:text-green-300">
                          Приложение установлено
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Вы используете установленную версию приложения
                        </p>
                      </div>
                    </div>
                  </div>
                ) : isIOSDevice ? (
                  // iOS device - show manual instructions
                  <IOSInstallInstructions mode="inline" showOnlyOnIOS={false} forceShow />
                ) : isInstallable ? (
                  // Browser supports installation
                  <div className="p-4 sm:p-6 rounded-xl border-2 bg-muted border-primary">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Download className="w-6 h-6 flex-shrink-0 mt-0.5 text-primary" />
                        <div>
                          <p className="font-semibold text-foreground">
                            Установите приложение
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Получите быстрый доступ и офлайн-режим
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        onClick={install}
                        isLoading={isInstalling}
                        loadingText="Установка..."
                      >
                        Установить
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Browser doesn't support installation
                  <div className="p-4 sm:p-6 rounded-xl border-2 bg-muted border-border">
                    <div className="flex items-start gap-3">
                      <Info className="w-6 h-6 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Установка недоступна
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Откройте сайт в Chrome, Safari или Edge и выберите "Добавить на главный экран" или "Установить приложение" в меню браузера
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Offline Storage */}
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground break-words">
                Офлайн-хранилище
              </h3>
              <div className="space-y-4">
                {/* Storage Usage - Using StorageQuotaInfo component */}
                <StorageQuotaInfo showBreakdown />

                {/* Persistent Storage */}
                <div className="p-4 sm:p-6 rounded-xl border-2 bg-muted border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">Постоянное хранилище</span>
                        {storageInfo?.isPersistent ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {storageInfo?.isPersistent
                          ? 'Ваши данные защищены от автоматического удаления'
                          : 'Браузер может автоматически удалить данные при нехватке места'}
                      </p>
                    </div>
                    {!storageInfo?.isPersistent && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => requestPersistence()}
                        isLoading={isRequestingPersistence}
                        loadingText="Запрос..."
                      >
                        Запросить
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Section 3: Push Notifications */}
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground break-words">
                Push-уведомления
              </h3>
              <div className="space-y-4">
                {!isPushSupported ? (
                  // Push not supported
                  <div className="p-4 sm:p-6 rounded-xl border-2 bg-muted border-border">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Push-уведомления не поддерживаются
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ваш браузер не поддерживает push-уведомления
                        </p>
                      </div>
                    </div>
                  </div>
                ) : !canUsePush ? (
                  // Can't use push (iOS not in standalone)
                  <div className="p-4 sm:p-6 rounded-xl border-2 bg-muted border-border">
                    <div className="flex items-start gap-3">
                      <Info className="w-6 h-6 flex-shrink-0 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Установите приложение
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {unavailableReason || 'Для получения уведомлений установите приложение на главный экран'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : permissionState === 'denied' ? (
                  // Permission denied
                  <div className="p-4 sm:p-6 rounded-xl border-2 bg-red-50 dark:bg-red-950 border-red-500">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-red-500" />
                      <div>
                        <p className="font-semibold text-red-700 dark:text-red-300">
                          Уведомления заблокированы
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          Разрешите уведомления в настройках браузера
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Push available - show toggle
                  <>
                    <div className="p-4 sm:p-6 rounded-xl border-2 bg-muted border-border">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <BellRing className="w-6 h-6 flex-shrink-0 mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-foreground">
                              Получать уведомления
                            </p>
                            <p className="text-sm text-muted-foreground">
                              О завершении обработки книг и генерации изображений
                            </p>
                          </div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={isSubscribed}
                          onClick={() => isSubscribed ? unsubscribePush() : subscribePush()}
                          disabled={isPushLoading}
                          className={cn(
                            'relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                            isSubscribed ? 'bg-green-500' : 'bg-zinc-600'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
                              isSubscribed ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Test notification button */}
                    {isSubscribed && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => testNotification()}
                        disabled={isPushLoading}
                      >
                        <Bell className="w-4 h-4 mr-2" />
                        Тестовое уведомление
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Clear Data Confirmation Dialog */}
            <ConfirmDialog
              isOpen={showClearDataDialog}
              onClose={() => setShowClearDataDialog(false)}
              title="Очистить офлайн-данные?"
              description="Все скачанные книги, изображения и кэшированные данные будут удалены. Это действие нельзя отменить."
              confirmText="Очистить"
              cancelText="Отмена"
              destructive
              onConfirm={handleClearOfflineData}
              isLoading={isClearingData}
            />
          </div>
        );

      case 'about':
        return (
          <div className="space-y-6 max-w-full overflow-hidden">
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground break-words">
                О fancai
              </h3>
              <div className="space-y-6">
                {/* Version */}
                <div>
                  <p className="font-semibold mb-2 text-foreground">
                    Версия
                  </p>
                  <p className="text-sm text-muted-foreground">
                    1.0.0 (Бета)
                  </p>
                </div>

                {/* Description */}
                <div>
                  <p className="font-semibold mb-2 text-foreground">
                    Описание
                  </p>
                  <p className="text-sm text-muted-foreground break-words">
                    Преобразите ваше чтение с AI-генерацией изображений из описаний книг.
                    Умная система распознавания текста находит описания локаций, персонажей
                    и атмосферы, создавая уникальные визуализации для каждой книги.
                  </p>
                </div>

                {/* Tech Stack */}
                <div>
                  <p className="font-semibold mb-3 text-foreground">
                    Технологический стек
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: 'Frontend', value: 'React 18 + TypeScript' },
                      { label: 'Backend', value: 'FastAPI + Python' },
                      { label: 'База данных', value: 'PostgreSQL 15+' },
                      { label: 'AI', value: 'Multi-NLP + pollinations.ai' },
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-xl border-2 bg-muted border-border min-w-0"
                      >
                        <p className="text-xs font-medium mb-1 text-muted-foreground break-words">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold text-foreground break-words">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Links */}
                <div className="pt-6 border-t border-border">
                  <div className="flex flex-wrap gap-4">
                    <a
                      href="https://github.com"
                      className="text-sm font-medium hover:underline text-primary"
                    >
                      GitHub
                    </a>
                    <a
                      href="#"
                      className="text-sm font-medium hover:underline text-primary"
                    >
                      Документация
                    </a>
                    <a
                      href="#"
                      className="text-sm font-medium hover:underline text-primary"
                    >
                      Поддержка
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Mobile accordion items - built from tabs
  const accordionItems: AccordionItem[] = [
    {
      id: 'account',
      title: 'Аккаунт',
      description: 'Профиль и настройки подписки',
      icon: User,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground">
            {t('profile.personalInfo')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">
                {t('profile.fullName')}
              </label>
              <input
                type="text"
                value={user?.full_name || ''}
                className="w-full px-4 py-3 min-h-[44px] rounded-xl border-2 bg-muted border-border text-foreground"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">
                {t('profile.email')}
              </label>
              <input
                type="email"
                value={user?.email || ''}
                className="w-full px-4 py-3 min-h-[44px] rounded-xl border-2 bg-muted border-border text-foreground"
                readOnly
              />
            </div>
          </div>
          <div className="p-3 rounded-xl border-2 bg-muted border-border">
            <p className="text-xs text-muted-foreground">
              Настройки аккаунта доступны только для чтения.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'notifications',
      title: t('settings.notifications'),
      description: 'Настройки уведомлений',
      icon: Bell,
      content: (
        <div className="space-y-4">
          {/* iOS Push Guidance - compact version for mobile */}
          {needsIOSPushGuidance && (
            <IOSPushGuidance className="mb-2" />
          )}

          <div className="space-y-2">
            <ToggleSwitch
              checked={bookProcessing}
              onChange={setBookProcessing}
              label="Обработка книги"
              description="Уведомление о завершении обработки"
            />
            <div className="h-px bg-border" />
            <ToggleSwitch
              checked={imageGeneration}
              onChange={setImageGeneration}
              label="Генерация изображений"
              description="Уведомление о новых изображениях"
            />
            <div className="h-px bg-border" />
            <ToggleSwitch
              checked={readingReminders}
              onChange={setReadingReminders}
              label="Напоминания о чтении"
              description="Напоминания продолжить чтение"
            />
          </div>
        </div>
      ),
    },
    {
      id: 'privacy',
      title: t('settings.privacy'),
      description: 'Конфиденциальность и безопасность',
      icon: Shield,
      content: (
        <div className="space-y-4">
          <div className="p-3 rounded-xl border-2 bg-muted border-primary">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
              <p className="text-sm text-foreground">
                Ваши данные хранятся безопасно и не передаются третьим лицам.
              </p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-foreground text-sm">Сбор данных</h4>
            <div className="space-y-1.5">
              {[
                'Прогресс чтения и закладки',
                'Сгенерированные изображения',
                'Анонимная статистика',
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                  <span className="text-xs text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'pwa',
      title: 'Приложение',
      description: 'Установка, хранилище и уведомления',
      icon: Smartphone,
      content: (
        <div className="space-y-6">
          {/* Installation Section */}
          <div>
            <h4 className="font-semibold mb-3 text-foreground text-sm">Установка</h4>
            {isInstalled ? (
              <div className="p-3 rounded-xl border-2 bg-green-50 dark:bg-green-950 border-green-500">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Приложение установлено
                  </span>
                </div>
              </div>
            ) : isIOSDevice ? (
              <IOSInstallInstructions mode="inline" showOnlyOnIOS={false} forceShow />
            ) : isInstallable ? (
              <div className="p-3 rounded-xl border-2 bg-muted border-primary">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground">Установить приложение</span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={install}
                    isLoading={isInstalling}
                  >
                    Установить
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border-2 bg-muted border-border">
                <p className="text-xs text-muted-foreground">
                  Выберите "Добавить на главный экран" в меню браузера
                </p>
              </div>
            )}
          </div>

          {/* Storage Section */}
          <div>
            <h4 className="font-semibold mb-3 text-foreground text-sm">Хранилище</h4>
            <div className="space-y-3">
              {/* Storage Progress */}
              <div className="p-3 rounded-xl border-2 bg-muted border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Использовано</span>
                  </div>
                  {storageInfo && (
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)}
                    </span>
                  )}
                </div>
                {storageInfo && (
                  <Progress
                    value={storageInfo.percentUsed}
                    className={cn(
                      'h-2',
                      storageInfo.isCritical && '[&>div]:bg-red-500',
                      storageInfo.isWarning && !storageInfo.isCritical && '[&>div]:bg-yellow-500'
                    )}
                  />
                )}
                {storageInfo?.isCritical && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Критически мало места!
                  </p>
                )}
                {storageInfo?.isWarning && !storageInfo.isCritical && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                    Заканчивается место
                  </p>
                )}
              </div>

              {/* Offline Books */}
              <div className="flex items-center justify-between p-3 rounded-xl border-2 bg-muted border-border">
                <div className="flex items-center gap-2">
                  <Book className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Скачанные книги</span>
                </div>
                <span className="font-semibold text-foreground">{offlineBooks.length}</span>
              </div>

              {/* Persistent Storage */}
              <div className="flex items-center justify-between p-3 rounded-xl border-2 bg-muted border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Постоянное хранилище</span>
                  {storageInfo?.isPersistent ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                {!storageInfo?.isPersistent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => requestPersistence()}
                    isLoading={isRequestingPersistence}
                    className="h-8 px-2"
                  >
                    Запросить
                  </Button>
                )}
              </div>

              {/* Clear Data */}
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => setShowClearDataDialog(true)}
                disabled={isClearingData}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Очистить данные
              </Button>
            </div>
          </div>

          {/* Push Notifications Section */}
          <div>
            <h4 className="font-semibold mb-3 text-foreground text-sm">Push-уведомления</h4>
            {!isPushSupported ? (
              <div className="p-3 rounded-xl border-2 bg-muted border-border">
                <p className="text-xs text-muted-foreground">
                  Push-уведомления не поддерживаются
                </p>
              </div>
            ) : !canUsePush ? (
              <div className="p-3 rounded-xl border-2 bg-muted border-border">
                <p className="text-xs text-muted-foreground">
                  {unavailableReason || 'Установите приложение для получения уведомлений'}
                </p>
              </div>
            ) : permissionState === 'denied' ? (
              <div className="p-3 rounded-xl border-2 bg-red-50 dark:bg-red-950 border-red-500">
                <p className="text-xs text-red-600 dark:text-red-400">
                  Уведомления заблокированы в настройках браузера
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl border-2 bg-muted border-border">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Уведомления</span>
                  </div>
                  <button
                    role="switch"
                    aria-checked={isSubscribed}
                    onClick={() => isSubscribed ? unsubscribePush() : subscribePush()}
                    disabled={isPushLoading}
                    className={cn(
                      'relative inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'disabled:opacity-50',
                      isSubscribed ? 'bg-green-500' : 'bg-zinc-600'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                        isSubscribed ? 'translate-x-5' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
                {isSubscribed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testNotification()}
                    disabled={isPushLoading}
                    className="w-full"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Тест
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Clear Data Dialog (rendered here for mobile) */}
          <ConfirmDialog
            isOpen={showClearDataDialog}
            onClose={() => setShowClearDataDialog(false)}
            title="Очистить офлайн-данные?"
            description="Все скачанные книги и кэшированные данные будут удалены."
            confirmText="Очистить"
            cancelText="Отмена"
            destructive
            onConfirm={handleClearOfflineData}
            isLoading={isClearingData}
          />
        </div>
      ),
    },
    {
      id: 'about',
      title: 'О программе',
      description: 'Версия и информация',
      icon: Info,
      content: (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-sm text-foreground">Версия</p>
            <p className="text-xs text-muted-foreground">1.0.0 (Бета)</p>
          </div>
          <div>
            <p className="font-semibold text-sm mb-1 text-foreground">Описание</p>
            <p className="text-xs text-muted-foreground">
              AI-генерация изображений из описаний книг для улучшенного чтения.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Frontend', value: 'React + TypeScript' },
              { label: 'Backend', value: 'FastAPI + Python' },
            ].map((item, index) => (
              <div key={index} className="p-2 rounded-lg border bg-muted border-border">
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
                <p className="text-xs font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-2 sm:py-4 lg:py-6 w-full max-w-full box-border">
      {/* Header */}
      <div className="mb-3 sm:mb-4 md:mb-6">
        <h1 className="fluid-h2 font-bold mb-1 text-foreground break-words">
          {t('settings.title')}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground break-words">
          Настройте ваш процесс чтения и управляйте настройками аккаунта
        </p>
      </div>

      {/* Mobile: Accordion Navigation */}
      <div className="lg:hidden">
        <Accordion
          items={accordionItems}
          defaultOpen="account"
        />
      </div>

      {/* Desktop: Sidebar + Content */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Desktop Sidebar Navigation */}
        <aside className="lg:col-span-3">
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl transition-all border-2',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{tab.label}</p>
                      <p
                        className={cn(
                          'text-xs truncate mt-0.5',
                          isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                        )}
                      >
                        {tab.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-9 min-w-0 w-full max-w-full">
          <div className="rounded-xl border-2 p-6 bg-background border-border overflow-hidden">
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
