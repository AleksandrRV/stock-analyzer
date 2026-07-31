import React from 'react';
import { Sliders, Database, FileText } from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Настройки приложения</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Заглушка экрана настроек (будет реализован на Этапе 9)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-500 w-fit rounded-xl">
            <Sliders className="w-5 h-5" />
          </div>
          <h3 className="font-semibold">Глобальные правила</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Налог на дивиденды (15%), переименования тикеров.</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 w-fit rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="font-semibold">Управление кэшем</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Гранулярная очистка IndexedDB цен и дивидендов.</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-500 w-fit rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="font-semibold">Импорт / Экспорт</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Сохранение и загрузка JSON файлов портфелей.</p>
        </div>
      </div>
    </div>
  );
};