// frontend/src/components/Reader/ProgressSaveIndicator.tsx
import { useEffect, useState } from 'react';

interface Props {
  lastSaved: number | null;
  isSaving: boolean;
}

export function ProgressSaveIndicator({ lastSaved, isSaving }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (lastSaved) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  if (!visible && !isSaving) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="bg-gray-800/90 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
        {isSaving ? (
          <>
            <span className="animate-spin">⏳</span>
            Сохранение...
          </>
        ) : (
          <>
            <span className="text-green-400">✓</span>
            Позиция сохранена
          </>
        )}
      </div>
    </div>
  );
}
