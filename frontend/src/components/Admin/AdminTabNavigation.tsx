/**
 * AdminTabNavigation - Навигация по табам админ-панели
 *
 * Отображает:
 * - Навигационные табы (Overview, NLP, Parsing, Images, System, Users)
 * - Активный таб с подсветкой
 * - Иконки для каждого таба
 *
 * @param activeTab - Текущий активный таб
 * @param onTabChange - Callback при изменении таба
 * @param t - Функция перевода
 */

import React from 'react';
import { Activity, Cpu, Database, Image, Server, Users } from 'lucide-react';

export type AdminTab = 'overview' | 'nlp' | 'parsing' | 'images' | 'system' | 'users';

interface AdminTabNavigationProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  t: (key: string) => string;
}

export const AdminTabNavigation: React.FC<AdminTabNavigationProps> = ({
  activeTab,
  onTabChange,
  t,
}) => {
  const tabs = [
    { id: 'overview' as AdminTab, name: t('admin.overview'), icon: Activity },
    { id: 'nlp' as AdminTab, name: t('admin.multiNlpSettings'), icon: Cpu },
    { id: 'parsing' as AdminTab, name: t('admin.parsing'), icon: Database },
    { id: 'images' as AdminTab, name: t('admin.images'), icon: Image },
    { id: 'system' as AdminTab, name: t('admin.system'), icon: Server },
    { id: 'users' as AdminTab, name: t('admin.users'), icon: Users }
  ];

  return (
    <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
