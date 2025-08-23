import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore } from '@/stores/ui';
import { cn } from '@/utils/cn';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useUIStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIconStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'p-4 rounded-lg border shadow-lg',
              getStyles(notification.type)
            )}
          >
            <div className="flex items-start">
              <div className={cn('flex-shrink-0', getIconStyles(notification.type))}>
                {getIcon(notification.type)}
              </div>
              
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-medium">
                  {notification.title}
                </h4>
                {notification.message && (
                  <p className="mt-1 text-sm opacity-90">
                    {notification.message}
                  </p>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => removeNotification(notification.id)}
                className="ml-4 flex-shrink-0 text-current opacity-60 hover:opacity-80 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationContainer;