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
    <div className="mb-4 sm:mb-6 md:mb-8">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
        <Shield className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 flex-shrink-0" />
        <span className="truncate">{title}</span>
      </h1>
      <p className="mt-1 text-xs sm:text-sm md:text-base text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
};
