/**
 * Utility functions for formatting values
 *
 * Provides consistent formatting across the application for:
 * - Reading time (minutes to human-readable format)
 * - Other formatting utilities as needed
 */

/**
 * Format minutes into a human-readable Russian time string
 *
 * @param minutes - Number of minutes to format
 * @returns Formatted string like "0 мин", "45 мин", "2ч", "1ч 30м"
 *
 * @example
 * formatReadingTime(0)   // "0 мин"
 * formatReadingTime(45)  // "45 мин"
 * formatReadingTime(60)  // "1ч"
 * formatReadingTime(90)  // "1ч 30м"
 * formatReadingTime(120) // "2ч"
 */
export const formatReadingTime = (minutes: number): string => {
  if (minutes === 0) return '0 мин';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} мин`;
  return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
};
