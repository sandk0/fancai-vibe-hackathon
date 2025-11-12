/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Simple translation hook for Russian localization
 * Простой хук перевода для русской локализации
 */

import ru from '@/locales/ru';

type TranslationPath = string;

/**
 * Get nested translation value by dot notation path
 * Получить вложенное значение перевода по пути с точками
 *
 * @example
 * t('auth.welcomeBack') // returns 'Добро пожаловать!'
 * t('library.booksCount', { count: 5 }) // returns '5 книг в вашей коллекции'
 */
export function useTranslation() {
  const t = (path: TranslationPath, params?: Record<string, string | number>): string => {
    // Navigate through nested object using dot notation
    const keys = path.split('.');
    let value: any = ru;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        console.warn(`Translation key not found: ${path}`);
        return path; // Return key if translation not found
      }
    }

    // If no value found or value is not a string, return the path
    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${path}`);
      return path;
    }

    // Replace parameters in string
    if (params) {
      return Object.entries(params).reduce((result, [key, val]) => {
        return result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
      }, value);
    }

    return value;
  };

  return { t, locale: 'ru' };
}

export default useTranslation;
