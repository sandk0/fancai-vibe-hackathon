import { Link, useLocation } from 'react-router-dom';
import { Home, Library, Image, Settings, User } from 'lucide-react';
import { isActiveRoute } from '@/utils/navigation';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * BottomNav - Mobile navigation component
 *
 * Features:
 * - Fixed at bottom of screen
 * - Hidden on desktop (md:hidden)
 * - Backdrop blur for modern appearance
 * - Safe area support for iOS notch/home indicator
 * - Touch targets >= 44px for accessibility
 * - Smooth transitions for active states
 */
export function BottomNav() {
  const location = useLocation();

  const navItems: NavItem[] = [
    { path: '/', label: 'Главная', icon: Home },
    { path: '/library', label: 'Библиотека', icon: Library },
    { path: '/images', label: 'Галерея', icon: Image },
    { path: '/settings', label: 'Настройки', icon: Settings },
    { path: '/profile', label: 'Профиль', icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-[500] md:hidden"
      role="navigation"
      aria-label="Мобильная навигация"
      style={{ position: 'fixed' }}
    >
      {/* Background with blur */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-lg border-t border-border"
        aria-hidden="true"
      />

      {/* Navigation items */}
      <ul className="relative flex items-center justify-around pb-safe">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = isActiveRoute(location.pathname, path);

          return (
            <li key={path} className="flex-1">
              <Link
                to={path}
                className={`
                  flex flex-col items-center justify-center
                  min-h-[56px] py-2 px-1
                  touch-target
                  transition-colors duration-200 ease-out
                  ${active
                    ? 'text-[var(--color-accent-500)]'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={`
                    w-6 h-6 mb-1
                    transition-transform duration-200 ease-out
                    ${active ? 'scale-110' : 'scale-100'}
                  `}
                  aria-hidden="true"
                />
                <span
                  className={`
                    text-[11px] sm:text-xs font-medium leading-tight
                    transition-opacity duration-200
                    ${active ? 'opacity-100' : 'opacity-80'}
                  `}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomNav;
