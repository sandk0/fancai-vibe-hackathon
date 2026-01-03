import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Menu,
  User,
  Settings,
  LogOut,
  Upload,
  Library,
  Home,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { useTranslation } from '@/hooks/useTranslation';
import { ThemeSwitcher } from '@/components/UI/ThemeSwitcher';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore();
  const { setShowUploadModal } = useUIStore();
  const { t } = useTranslation();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  // Close menu on escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showUserMenu]);

  const navLinks = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/library', label: t('nav.library'), icon: Library },
  ];

  const isActiveLink = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-40 pt-safe border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Left side - Logo and Mobile Menu */}
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-target"
              onClick={onMenuClick}
              aria-label={t('nav.openMenu')}
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground hidden sm:block">
                fancai
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-6" aria-label={t('nav.mainNavigation') || 'Main navigation'}>
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isActiveLink(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    aria-current={isActive ? 'page' : undefined}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                      ${isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side - Actions and User menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Upload button - icon only on mobile */}
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] touch-target"
              aria-label={t('nav.uploadBook')}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">{t('nav.uploadBook')}</span>
            </button>

            {/* Theme Switcher */}
            <ThemeSwitcher />

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="flex items-center gap-2 p-1 rounded-full transition-all hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                aria-haspopup="true"
              >
                <span className="sr-only">{t('nav.openUserMenu')}</span>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                  <span className="text-sm font-medium">
                    {user?.full_name
                      ? user.full_name.charAt(0).toUpperCase()
                      : user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <ChevronDown
                  className={`hidden sm:block w-4 h-4 text-muted-foreground transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {/* User dropdown */}
              {showUserMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl shadow-lg py-1 ring-1 ring-border bg-popover/95 backdrop-blur-md animate-fade-in-up"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {user?.email}
                    </p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                      role="menuitem"
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      {t('nav.profile')}
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                      role="menuitem"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      {t('nav.settings')}
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-border py-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('nav.signOut')}
                    </button>
                  </div>
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
