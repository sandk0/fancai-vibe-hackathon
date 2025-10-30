import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Library,
  Image,
  Settings,
  BarChart3,
  BookOpen,
  Sparkles,
  Shield,
  User
} from 'lucide-react';
import { useUIStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/utils/cn';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const navigation = [
    {
      name: t('nav.home'),
      href: '/',
      icon: Home,
    },
    {
      name: t('nav.myLibrary'),
      href: '/library',
      icon: Library,
    },
    {
      name: t('nav.generatedImages'),
      href: '/images',
      icon: Image,
    },
    {
      name: t('nav.readingStats'),
      href: '/stats',
      icon: BarChart3,
    },
    {
      name: t('nav.profile'),
      href: '/profile',
      icon: User,
    },
    {
      name: t('nav.settings'),
      href: '/settings',
      icon: Settings,
    },
    ...(user?.is_admin ? [{
      name: t('nav.adminDashboard'),
      href: '/admin',
      icon: Shield,
    }] : []),
  ];

  const handleLinkClick = () => {
    // Close sidebar on mobile when link is clicked
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="flex items-center flex-shrink-0 px-4 mb-8">
              <BookOpen className="w-8 h-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                BookReader AI
              </span>
            </div>
            
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    )}
                  >
                    <Icon
                      className={cn(
                        'mr-3 flex-shrink-0 h-5 w-5',
                        isActive
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User info section */}
            <div className="flex-shrink-0 px-4 py-4 border-t" style={{
              borderColor: 'var(--border-color)',
            }}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                    backgroundColor: 'var(--accent-color)',
                  }}>
                    <span className="text-sm font-medium text-white">
                      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs flex items-center" style={{ color: 'var(--text-secondary)' }}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Free Plan
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transition-transform transform bg-white dark:bg-gray-800 lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full pt-5 pb-4 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center flex-shrink-0 px-4 mb-8">
            <BookOpen className="w-8 h-8 text-primary-600" />
            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
              BookReader AI
            </span>
          </div>
          
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <Icon
                    className={cn(
                      'mr-3 flex-shrink-0 h-5 w-5',
                      isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="flex-shrink-0 px-4 py-4 border-t" style={{
            borderColor: 'var(--border-color)',
          }}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                  backgroundColor: 'var(--accent-color)',
                }}>
                  <span className="text-sm font-medium text-white">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user?.full_name || t('nav.user')}
                </p>
                <p className="text-xs flex items-center" style={{ color: 'var(--text-secondary)' }}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {t('nav.freePlan')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;