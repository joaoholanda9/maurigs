import {
  Archive,
  Award,
  CalendarDays,
  Feather,
  LayoutDashboard,
  Lock,
  Plus,
  Smartphone,
  Timer,
  Trophy,
} from 'lucide-react';
import type { AppTab, Championship } from '../types/championship';

interface NavigationProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onQuickStartTournament: () => void;
  activeChampionship: Championship;
  activeChampionships: Championship[];
  closedCount: number;
  onSelectChampionship: (championshipId: string) => void;
  onOpenNewChampionship: () => void;
}

const NAV_ITEMS: {
  id: AppTab;
  label: string;
  mobileLabel: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'painel', label: 'Painel', mobileLabel: 'Painel', icon: LayoutDashboard },
  { id: 'torneio', label: 'Torneio', mobileLabel: 'Torneio', icon: Timer },
  { id: 'registro', label: 'Registro Mobile', mobileLabel: 'Registro', icon: Smartphone },
  { id: 'etapas', label: 'Etapas', mobileLabel: 'Etapas', icon: CalendarDays },
  { id: 'aves', label: 'Aves', mobileLabel: 'Aves', icon: Feather },
  { id: 'ranking', label: 'Ranking', mobileLabel: 'Ranking', icon: Award },
  {
    id: 'historico',
    label: 'Histórico / Encerrados',
    mobileLabel: 'Histórico',
    icon: Archive,
  },
];

export function TopNav({
  activeTab,
  onSelectTab,
  onQuickStartTournament,
  activeChampionship,
  activeChampionships,
  closedCount,
  onSelectChampionship,
  onOpenNewChampionship,
}: NavigationProps) {
  const isClosed = activeChampionship.status === 'Encerrado';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 print:hidden">
      {/* Desktop & Tablet 3-Zone Top Bar */}
      <div className="hidden md:flex max-w-5xl mx-auto px-4 lg:px-5 h-13 items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelectTab('painel')}
          className="font-display text-sm lg:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-emerald-800 transition-colors cursor-pointer"
        >
          Canto &amp; Fibra
        </button>

        <nav
          aria-label="Navegação principal"
          className="flex items-center gap-2.5 lg:gap-4 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1.5 text-xs lg:text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-emerald-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {item.id === 'historico' && closedCount > 0 && (
                  <span className="ml-1 font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {closedCount}
                  </span>
                )}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-700 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onQuickStartTournament}
            className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
          >
            Mesa do Torneio
          </button>
        </div>
      </div>

      {/* Mobile Compact Top Bar (44px) */}
      <div className="flex md:hidden px-3.5 h-11 items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelectTab('painel')}
          className="font-display text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Canto &amp; Fibra
        </button>

        <button
          type="button"
          onClick={onQuickStartTournament}
          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          Mesa ao vivo
        </button>
      </div>

      {/* Main Championship Switcher Bar (Active Championships + New Championship Button) */}
      <div className="border-t border-slate-100 bg-slate-50/90">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Trophy className="w-3.5 h-3.5 text-emerald-700 shrink-0 hidden sm:block" />
            <label htmlFor="top-championship-selector" className="sr-only">
              Campeonato em andamento
            </label>
            <select
              id="top-championship-selector"
              aria-label="Selecionar campeonato em andamento"
              value={isClosed ? '' : activeChampionship.id}
              onChange={(e) => {
                if (e.target.value) {
                  onSelectChampionship(e.target.value);
                }
              }}
              className="min-w-0 flex-1 max-w-md h-[34px] px-2.5 text-xs sm:text-[13px] font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer truncate"
            >
              {isClosed && (
                <option value="" disabled>
                  {activeChampionships.length > 0
                    ? 'Alternar para campeonato em andamento...'
                    : `Encerrado: ${activeChampionship.name}`}
                </option>
              )}
              {activeChampionships.length === 0 ? (
                <option value="" disabled>
                  Nenhum campeonato em andamento
                </option>
              ) : (
                activeChampionships.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.modality} · {c.seasonYear})
                  </option>
                ))
              )}
            </select>

            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-600 shrink-0">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-semibold text-emerald-900">
                {activeChampionship.modality}
              </span>
              <span className="font-mono tabular-nums font-medium text-slate-600">
                {activeChampionship.stages.length}/{activeChampionship.plannedStages} etapas
              </span>
              {isClosed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-semibold">
                  <Lock className="w-3 h-3" />
                  Encerrado
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenNewChampionship}
            className="h-[34px] px-2.5 sm:px-3 inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200/80 border border-emerald-300/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Campeonato</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
}: {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}) {
  return (
    <nav
      aria-label="Navegação inferior"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 print:hidden"
    >
      <div className="grid grid-cols-7 items-center h-14 px-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onClick={() => onSelectTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg transition-colors cursor-pointer ${
                isActive ? 'text-emerald-800' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.25 : 1.75} />
              <span
                className={`text-[9px] leading-none mt-1 whitespace-nowrap ${
                  isActive ? 'font-semibold' : 'font-medium'
                }`}
              >
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
