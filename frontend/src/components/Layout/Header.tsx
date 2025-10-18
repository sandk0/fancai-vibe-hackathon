import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Menu,
  Search,
  User,
  Settings,
  LogOut,
  Upload,
  Moon,
  Sun
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { useReaderStore } from '@/stores/reader';
import { useTranslation } from '@/hooks/useTranslation';
import { WebSocketStatus } from '@/services/websocket';

const Header: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen, setShowUploadModal, setShowProfileModal } = useUIStore();
  const { theme, updateTheme } = useReaderStore();
  const { t } = useTranslation();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'sepia' : 'light';
    updateTheme(newTheme);
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo and Navigation */}
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Logo */}
            <Link to="/" className="flex items-center ml-4 lg:ml-0">
              <div className="flex items-center">
                <BookOpen className="w-8 h-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white hidden sm:block">
                  BookReader AI
                </span>
              </div>
            </Link>
          </div>

          {/* Center - Search */}
          <div className="flex-1 max-w-lg mx-8 hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={t('nav.searchBooks')}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Right side - Actions and User menu */}
          <div className="flex items-center space-x-4">
            {/* WebSocket Status */}
            <WebSocketStatus className="hidden sm:flex" />
            
            {/* Upload button */}
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:block">{t('nav.uploadBook')}</span>
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              title={t('nav.switchTheme').replace('{theme}', t(`nav.${theme === 'light' ? 'darkMode' : theme === 'dark' ? 'sepiaMode' : 'lightMode'}`))}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                type="button"
                className="flex items-center max-w-xs text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span className="sr-only">{t('nav.openUserMenu')}</span>
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
                  </span>
                </div>
              </button>

              {/* User dropdown */}
              {showUserMenu && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700">
                    <div className="font-medium">{user?.full_name || 'User'}</div>
                    <div className="text-gray-500 dark:text-gray-400">{user?.email}</div>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileModal(true);
                      setShowUserMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <User className="w-4 h-4 mr-3" />
                    {t('nav.profile')}
                  </button>

                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Settings className="w-4 h-4 mr-3" />
                    {t('nav.settings')}
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    {t('nav.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;