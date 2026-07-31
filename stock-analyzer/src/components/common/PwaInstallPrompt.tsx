import React, { useState } from 'react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { Smartphone, Download, X } from 'lucide-react';

export const PwaInstallPrompt: React.FC = () => {
  const { isInstallable, promptInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isInstallable || isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-sky-500 to-indigo-600 text-white p-3.5 px-4 rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/10 rounded-xl">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h4 className="font-bold text-xs sm:text-sm leading-tight">Установить приложение на устройство</h4>
          <p className="text-[11px] text-sky-100 hidden sm:block">Работает без интернета, быстрая загрузка без строки браузера</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={promptInstall}
          className="px-3.5 py-1.5 bg-white text-sky-600 hover:bg-sky-50 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Установить</span>
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 text-white/70 hover:text-white rounded-lg transition-colors"
          title="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};