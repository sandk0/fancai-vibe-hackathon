/**
 * SettingsPage - Modern redesign with shadcn UI components
 *
 * Features:
 * - Tab-based navigation with icons
 * - Reader settings (theme, font, size)
 * - Account settings
 * - Notification preferences
 * - Privacy & security
 * - About section
 * - Fully theme-aware (Light/Dark/Sepia)
 * - Responsive sidebar
 */

import React, { useState } from 'react';
import { Book, User, Bell, Shield, Info, Check } from 'lucide-react';
import ReaderSettings from '@/components/Settings/ReaderSettings';
import { useAuthStore } from '@/stores/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

type SettingsTab = 'reader' | 'account' | 'notifications' | 'privacy' | 'about';

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
    <div className="flex items-center justify-between py-4">
      <div className="flex-1">
        <label
          id={switchId}
          className="font-medium text-foreground cursor-pointer"
        >
          {label}
        </label>
        <p id={descriptionId} className="text-sm mt-1 text-muted-foreground">
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
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'min-h-[44px] min-w-[44px]',
          checked ? 'bg-green-500' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('reader');
  const { user } = useAuthStore();
  const { t } = useTranslation();

  // Notification settings state
  const [bookProcessing, setBookProcessing] = useState(true);
  const [imageGeneration, setImageGeneration] = useState(true);
  const [readingReminders, setReadingReminders] = useState(false);

  const tabs = [
    {
      id: 'reader' as SettingsTab,
      label: t('settings.reading'),
      icon: Book,
      description: 'Шрифт, тема и настройки чтения'
    },
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
      id: 'about' as SettingsTab,
      label: 'О программе',
      icon: Info,
      description: 'Версия приложения и информация'
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'reader':
        return <ReaderSettings />;

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
                    className="w-full px-4 py-3 rounded-xl border-2 bg-muted border-border text-foreground"
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
                    className="w-full px-4 py-3 rounded-xl border-2 bg-muted border-border text-foreground"
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
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground">
                Конфиденциальность и безопасность
              </h3>
              <div className="space-y-6">
                {/* Info Box */}
                <div className="p-6 rounded-xl border-2 bg-muted border-primary">
                  <div className="flex items-start gap-3">
                    <Shield className="w-6 h-6 flex-shrink-0 mt-0.5 text-primary" />
                    <p className="text-foreground">
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
                        <span className="text-sm text-muted-foreground">
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

      case 'about':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-6 text-foreground">
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
                  <p className="text-sm text-muted-foreground">
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
                        className="p-3 rounded-xl border-2 bg-muted border-border"
                      >
                        <p className="text-xs font-medium mb-1 text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold text-foreground">
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
          {t('settings.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          Настройте ваш процесс чтения и управляйте настройками аккаунта
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 mb-8 lg:mb-0">
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
        <main className="lg:col-span-9">
          <div className="rounded-xl border-2 p-6 lg:p-8 bg-background border-border">
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
