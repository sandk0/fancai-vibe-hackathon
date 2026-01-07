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
    <div className="mb-6 sm:mb-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
        <Shield className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
        <span className="truncate">{title}</span>
      </h1>
      <p className="mt-1 sm:mt-2 text-sm sm:text-base text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
};
