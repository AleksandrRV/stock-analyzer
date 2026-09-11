import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const VERSION_URL = `${import.meta.env.BASE_URL || '/'}version.json`;

/**
 * Сверяет версию запущенного приложения с version.json на GitHub Pages.
 * Если на сервере лежит более новая версия — показывает баннер с кнопкой
 * «Обновить», которая сбрасывает кэш Service Worker и перезагружает страницу.
 * Это решает проблему «залипшей» старой версии PWA.
 */
export const VersionCheck: React.FC = () => {
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(VERSION_URL, { cache: 'no-cache' });
        if (!resp.ok) return;
        const json = await resp.json();
        if (json && typeof json.version === 'string' && json.version !== __APP_VERSION__) {
          if (!cancelled) setNewVersion(json.version);
        }
      } catch {
        // нет сети или файла — просто не показываем баннер
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!newVersion) return null;

  const handleUpdate = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  return (
    <div className="max-w-7xl w-full mx-auto px-4 pt-4">
      <div className="p-3 bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 rounded-xl text-sm font-medium flex items-center justify-between gap-3 animate-in fade-in">
        <span>
          Доступна новая версия <strong>v{newVersion}</strong> (у вас v{__APP_VERSION__}).
        </span>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Обновить</span>
        </button>
      </div>
    </div>
  );
};
