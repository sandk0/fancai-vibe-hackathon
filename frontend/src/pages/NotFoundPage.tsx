/**
 * NotFoundPage - Modern 404 page with gradient design
 *
 * Features:
 * - Large animated 404 text
 * - Gradient effects
 * - Quick navigation links
 * - Search suggestion
 * - Fully theme-aware
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Library, Upload, Search, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  const quickLinks = [
    {
      icon: Home,
      label: 'Главная',
      path: '/',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: Library,
      label: 'Библиотека',
      path: '/library',
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      icon: Upload,
      label: 'Загрузить книгу',
      onClick: () => {
        navigate('/library');
        // TODO: trigger upload modal
      },
      color: 'text-green-600 dark:text-green-400',
    },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* 404 Animation */}
        <div className="relative mb-8">
          {/* Gradient Background */}
          <div
            className="absolute inset-0 blur-3xl opacity-30"
            style={{
              background:
                'radial-gradient(circle, var(--accent-color) 0%, transparent 70%)',
            }}
          />

          {/* 404 Text */}
          <h1
            className="relative text-9xl md:text-[12rem] font-black mb-4"
            style={{
              background: `linear-gradient(135deg, var(--accent-color) 0%, rgba(147, 51, 234, 0.8) 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            404
          </h1>
        </div>

        {/* Title */}
        <h2
          className="text-3xl md:text-4xl font-bold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Страница не найдена
        </h2>

        {/* Description */}
        <p className="text-lg mb-8" style={{ color: 'var(--text-secondary)' }}>
          Кажется, вы заблудились в цифровой библиотеке. Страница, которую вы ищете, не
          существует или была перемещена.
        </p>

        {/* Search Box */}
        <div className="max-w-md mx-auto mb-12">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
              style={{ color: 'var(--text-tertiary)' }}
            />
            <input
              type="text"
              placeholder="Может быть, вы искали..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  navigate(`/library?search=${encodeURIComponent(e.currentTarget.value)}`);
                }
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
            Нажмите Enter для поиска в библиотеке
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {quickLinks.map((link, index) => (
            <button
              key={index}
              onClick={() => (link.onClick ? link.onClick() : navigate(link.path!))}
              className={cn(
                'group p-6 rounded-2xl border-2 transition-all hover:scale-105 hover:shadow-lg'
              )}
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
              }}
            >
              <link.icon className={cn('w-8 h-8 mx-auto mb-3', link.color)} />
              <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {link.label}
              </div>
            </button>
          ))}
        </div>

        {/* Back to Home Button */}
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'white',
          }}
        >
          <Home className="w-5 h-5" />
          <span>На главную</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Help Text */}
        <p className="mt-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Если проблема сохраняется, попробуйте обновить страницу или{' '}
          <button
            onClick={() => navigate('/settings')}
            className="underline hover:no-underline"
            style={{ color: 'var(--accent-color)' }}
          >
            свяжитесь с поддержкой
          </button>
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;
