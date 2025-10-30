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
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex-1">
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
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
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                {t('profile.personalInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {t('profile.fullName')}
                  </label>
                  <input
                    type="text"
                    value={user?.full_name || ''}
                    className="w-full px-4 py-3 rounded-xl border-2"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {t('profile.email')}
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="w-full px-4 py-3 rounded-xl border-2"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    readOnly
                  />
                </div>
              </div>
              <div
                className="mt-6 p-4 rounded-xl border-2"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  ℹ️ Настройки аккаунта доступны только для чтения. Свяжитесь с поддержкой для изменений.
                </p>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                Настройки уведомлений
              </h3>
              <div className="space-y-2">
                <ToggleSwitch
                  checked={bookProcessing}
                  onChange={setBookProcessing}
                  label="Обработка книги"
                  description="Получать уведомление когда обработка книги завершена"
                />
                <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }} />

                <ToggleSwitch
                  checked={imageGeneration}
                  onChange={setImageGeneration}
                  label="Генерация изображений"
                  description="Получать уведомление когда создаются новые изображения"
                />
                <div className="h-px" style={{ backgroundColor: 'var(--border-color)' }} />

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
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                Конфиденциальность и безопасность
              </h3>
              <div className="space-y-6">
                {/* Info Box */}
                <div
                  className="p-6 rounded-2xl border-2"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--accent-color)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Shield className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} />
                    <p style={{ color: 'var(--text-primary)' }}>
                      Ваши книги и данные чтения хранятся безопасно и не передаются третьим лицам.
                    </p>
                  </div>
                </div>

                {/* Data Collection */}
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                    Сбор данных
                  </h4>
                  <div className="space-y-2">
                    {[
                      'Прогресс чтения и закладки',
                      'Сгенерированные изображения из ваших книг',
                      'Статистика использования приложения (анонимизированная)',
                    ].map((item, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-color)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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
              <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
                О BookReader AI
              </h3>
              <div className="space-y-6">
                {/* Version */}
                <div>
                  <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Версия
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    1.0.0 (Бета)
                  </p>
                </div>

                {/* Description */}
                <div>
                  <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Описание
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Преобразите ваше чтение с AI-генерацией изображений из описаний книг.
                    Умная система распознавания текста находит описания локаций, персонажей
                    и атмосферы, создавая уникальные визуализации для каждой книги.
                  </p>
                </div>

                {/* Tech Stack */}
                <div>
                  <p className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
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
                        className="p-3 rounded-xl border-2"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                        }}
                      >
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                          {item.label}
                        </p>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Links */}
                <div className="pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex flex-wrap gap-4">
                    <a
                      href="https://github.com"
                      className="text-sm font-medium hover:underline"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      GitHub →
                    </a>
                    <a
                      href="#"
                      className="text-sm font-medium hover:underline"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      Документация →
                    </a>
                    <a
                      href="#"
                      className="text-sm font-medium hover:underline"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      Поддержка →
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
        <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('settings.title')}
        </h1>
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
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
                  className="w-full text-left px-4 py-3 rounded-xl transition-all"
                  style={{
                    backgroundColor: isActive ? 'var(--accent-color)' : 'var(--bg-primary)',
                    color: isActive ? 'white' : 'var(--text-primary)',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{tab.label}</p>
                      <p
                        className="text-xs truncate mt-0.5"
                        style={{
                          color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)'
                        }}
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
          <div
            className="rounded-2xl border-2 p-6 lg:p-8"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
          >
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
