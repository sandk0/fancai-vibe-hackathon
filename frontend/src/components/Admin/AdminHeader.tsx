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
    <div className="mb-3 sm:mb-4 md:mb-6">
      <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
        <Shield className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 flex-shrink-0" />
        <span className="truncate">{title}</span>
      </h1>
      <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
};
