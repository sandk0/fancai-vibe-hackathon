/**
 * AdminHeader - Заголовок админ-панели
 *
 * Отображает:
 * - Заголовок с иконкой Shield
 * - Описание панели управления
 *
 * @param title - Заголовок (по умолчанию из переводов)
 * @param subtitle - Подзаголовок (по умолчанию из переводов)
 */

import React from 'react';
import { Shield } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
  subtitle: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle }) => {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Shield className="w-8 h-8" />
        {title}
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
};
