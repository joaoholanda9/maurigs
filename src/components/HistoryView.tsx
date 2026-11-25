import {
  Archive,
  Award,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  ImageDown,
  Lock,
  Printer,
  Search,
  Trophy,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  BIRD_MODALITIES,
  type BirdModality,
  type Championship,
  type MemberFilter,
} from '../types/championship';
import { exportReportToExcel, exportReportToPng } from '../utils/reportExport';
import {
  calculateApprovalPercent,
  computeGeneralRanking,
  computeStageRanking,
  countConcludedStages,
  downloadCsvFile,
  filterByMemberStatus,
  formatDatePtBr,
  formatPercentPtBr,
  formatScoreValue,
  isTimeScoredModality,
} from '../utils/scoring';
import { BirdEvolutionChart } from './BirdEvolutionChart';
import { CertificateGeneratorCard } from './CertificateGeneratorCard';
import { MemberFilterControl } from './MemberFilterControl';

interface HistoryViewProps {
  closedChampionships: Championship[];
  preselectedChampionshipId?: string | null;
}

type HistorySubTab = 'final' | 'etapas';

const FILTER_LABELS: Record<MemberFilter, string> = {
  all: 'Todos os competidores',
  members: 'Apenas Sócios',
  non_members: 'Não Sócios',
};

function formatClosedDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function HistoryView({
  closedChampionships,
  preselectedChampionshipId,
}: HistoryViewProps) {
  const [modalityFilter, setModalityFilter] = useState<'Todas' | BirdModality>('Todas');
  const [yearFilter, setYearFilter] = useState<'Todos' | number>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChampionshipId, setSelectedChampionshipId] = useState<string>(
    () => preselectedChampionshipId ?? closedChampionships[0]?.id ?? ''
  );
  const [subTab, setSubTab] = useState<HistorySubTab>('final');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [expandedBirdId, setExpandedBirdId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');

  useEffect(() => {
    if (
      preselectedChampionshipId &&
      closedChampionships.some((c) => c.id === preselectedChampionshipId)
    ) {
      setSelectedChampionshipId(preselectedChampionshipId);
    }
  }, [preselectedChampionshipId, closedChampionships]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const c of closedChampionships) {
      years.add(c.seasonYear);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [closedChampionships]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredChampionships = useMemo(() => {
    return closedChampionships
      .filter((c) => {
        if (modalityFilter !== 'Todas' && c.modality !== modalityFilter) return false;
        if (yearFilter !== 'Todos' && c.seasonYear !== yearFilter) return false;
        if (normalizedSearch) {
          const matchesBird = c.birds.some(
            (b) =>
              b.name.toLowerCase().includes(normalizedSearch) ||
              b.ownerName.toLowerCase().includes(normalizedSearch)
          );
          const matchesChamp = c.name.toLowerCase().includes(normalizedSearch);
          if (!matchesBird && !matchesChamp) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const closedA = a.closedAt ? new Date(a.closedAt).getTime() : 0;
        const closedB = b.closedAt ? new Date(b.closedAt).getTime() : 0;
        if (closedB !== closedA) return closedB - closedA;
        return b.seasonYear - a.seasonYear;
      });
  }, [closedChampionships, modalityFilter, yearFilter, normalizedSearch]);

  useEffect(() => {
    if (filteredChampionships.length === 0) {
      if (selectedChampionshipId !== '') setSelectedChampionshipId('');
      return;
    }
    if (!filteredChampionships.some((c) => c.id === selectedChampionshipId)) {
      setSelectedChampionshipId(filteredChampionships[0].id);
    }
  }, [filteredChampionships, selectedChampionshipId]);

  const activeChampionship = useMemo(
    () =>
      filteredChampionships.find((c) => c.id === selectedChampionshipId) ??
      filteredChampionships[0] ??
      null,
    [filteredChampionships, selectedChampionshipId]
  );

  // Reset sub-selections when switching archived championship
  useEffect(() => {
    setExpandedBirdId(null);
    if (!activeChampionship) {
      setSelectedStageId('');
      return;
    }
    const ordered = [...activeChampionship.stages].sort(
      (a, b) => a.stageNumber - b.stageNumber
    );
    setSelectedStageId(ordered[0]?.id ?? '');
  }, [activeChampionship?.id]);

  const championshipSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        championName: string;
        championOwner: string;
        championPoints: number;
        matchingBirdsCount: number;
      }
    >();
    for (const c of filteredChampionships) {
      const ranking = computeGeneralRanking(c.stages, c.entries, c.birds, {
        scoringPositions: c.rules.scoringPositions,
        minPart1ToScore: c.rules.minPart1ToScore,
      });
      const leader = ranking[0];
      const matchingBirdsCount = normalizedSearch
        ? c.birds.filter(
            (b) =>
              b.name.toLowerCase().includes(normalizedSearch) ||
              b.ownerName.toLowerCase().includes(normalizedSearch)
          ).length
        : c.birds.length;
      map.set(c.id, {
        championName: leader?.bird.name ?? 'Sem pontuação',
        championOwner: leader?.bird.ownerName ?? '',
        championPoints: leader?.totalPoints ?? 0,
        matchingBirdsCount,
      });
    }
    return map;
  }, [filteredChampionships, normalizedSearch]);

  const part1Minutes = activeChampionship?.rules.part1Minutes ?? 10;
  const part2Minutes = activeChampionship?.rules.part2Minutes ?? 15;
  const scoringPositions = activeChampionship?.rules.scoringPositions ?? 30;
  const minPart1ToScore = activeChampionship?.rules.minPart1ToScore ?? 1;
  const isTimeModality = isTimeScoredModality(activeChampionship?.modality);

  const concludedCount = useMemo(() => {
    if (!activeChampionship) return 0;
    return countConcludedStages(
      activeChampionship.stages,
      activeChampionship.entries,
      minPart1ToScore
    );
  }, [activeChampionship, minPart1ToScore]);

  const orderedStages = useMemo(() => {
    if (!activeChampionship) return [];
    return [...activeChampionship.stages].sort(
      (a, b) => a.stageNumber - b.stageNumber
    );
  }, [activeChampionship]);

  const activeStage = useMemo(() => {
    if (orderedStages.length === 0) return null;
    return orderedStages.find((s) => s.id === selectedStageId) ?? orderedStages[0];
  }, [orderedStages, selectedStageId]);

  const generalRanking = useMemo(() => {
    if (!activeChampionship) return [];
    return computeGeneralRanking(
      activeChampionship.stages,
      activeChampionship.entries,
      activeChampionship.birds,
      { scoringPositions, minPart1ToScore }
    );
  }, [activeChampionship, scoringPositions, minPart1ToScore]);

  const stageRanking = useMemo(() => {
    if (!activeChampionship || !activeStage) return [];
    return computeStageRanking(
      activeStage,
      activeChampionship.entries,
      activeChampionship.birds,
      { scoringPositions, minPart1ToScore }
    );
  }, [activeChampionship, activeStage, scoringPositions, minPart1ToScore]);

  const generalCounts = useMemo(
    () => ({
      all: generalRanking.length,
      members: generalRanking.filter((r) => r.bird.isMember).length,
      nonMembers: generalRanking.filter((r) => !r.bird.isMember).length,
    }),
    [generalRanking]
  );

  const stageCounts = useMemo(
    () => ({
      all: stageRanking.length,
      members: stageRanking.filter((r) => r.bird.isMember).length,
      nonMembers: stageRanking.filter((r) => !r.bird.isMember).length,
    }),
    [stageRanking]
  );

  const filteredGeneral = useMemo(() => {
    const byMember = filterByMemberStatus(generalRanking, memberFilter);
    if (!normalizedSearch) return byMember;
    return byMember.filter(
      (r) =>
        r.bird.name.toLowerCase().includes(normalizedSearch) ||
        r.bird.ownerName.toLowerCase().includes(normalizedSearch)
    );
  }, [generalRanking, memberFilter, normalizedSearch]);

  const filteredStage = useMemo(() => {
    const byMember = filterByMemberStatus(stageRanking, memberFilter);
    if (!normalizedSearch) return byMember;
    return byMember.filter(
      (r) =>
        r.bird.name.toLowerCase().includes(normalizedSearch) ||
        r.bird.ownerName.toLowerCase().includes(normalizedSearch) ||
        r.entry.stakeNumber.toLowerCase().includes(normalizedSearch)
    );
  }, [stageRanking, memberFilter, normalizedSearch]);

  const handleExportFinalExcel = () => {
    if (!activeChampionship) return;
    const emittedLabel = formatClosedDate(new Date().toISOString());
    const approvalHeader =
      concludedCount > 0 ? `Aprov. (E${concludedCount})` : 'Aprov.';

    exportReportToExcel({
      filename: `historico-${activeChampionship.modality.toLowerCase()}-${activeChampionship.seasonYear}.xlsx`,
      sheetName: 'Classificação Final',
      metadataRows: [
        ['Evento', activeChampionship.name],
        ['Modalidade', activeChampionship.modality],
        ['Temporada', activeChampionship.seasonYear],
        ['Status', 'Encerrado (Somente Leitura)'],
        ['Encerrado em', formatClosedDate(activeChampionship.closedAt)],
        ['Etapas Disputadas', `${activeChampionship.stages.length} de ${activeChampionship.plannedStages}`],
        ['Filtro Aplicado', FILTER_LABELS[memberFilter]],
        [
          'Critério de Desempate',
          isTimeModality
            ? 'Maior tempo total em todas as etapas'
            : 'Maior número total de cantos em todas as etapas',
        ],
        ['Emitido em', emittedLabel],
      ],
      headers: [
        'Pos.',
        'Ave',
        'Proprietário',
        `${isTimeModality ? 'Tempo' : 'Cantos'} ${part1Minutes}m`,
        `${isTimeModality ? 'Tempo' : 'Cantos'} ${part2Minutes}m`,
        isTimeModality ? 'Tempo Total' : 'Total Cantos',
        'Pontos',
        approvalHeader,
      ],
      rows: filteredGeneral.map((r) => [
        `${r.position}º`,
        r.bird.name,
        r.bird.ownerName,
        formatScoreValue(r.totalPart1Songs, activeChampionship.modality),
        formatScoreValue(r.totalPart2Songs, activeChampionship.modality),
        formatScoreValue(r.totalSongs, activeChampionship.modality),
        r.totalPoints,
        formatPercentPtBr(
          calculateApprovalPercent(r.totalPoints, concludedCount, scoringPositions)
        ),
      ]),
    });
  };

  const handleExportFinalPng = async () => {
    if (!activeChampionship) return;
    const emittedLabel = formatClosedDate(new Date().toISOString());
    const approvalHeader =
      concludedCount > 0 ? `Aprov. (E${concludedCount})` : 'Aprov.';

    await exportReportToPng({
      filename: `historico-${activeChampionship.modality.toLowerCase()}-${activeChampionship.seasonYear}.png`,
      championshipName: activeChampionship.name,
      seasonYear: activeChampionship.seasonYear,
      reportTitle: `Classificação Final — ${activeChampionship.modality} (Encerrado)`,
      issuedAtText: emittedLabel,
      filterLabel: FILTER_LABELS[memberFilter],
      infoBlocks: [
        {
          label: 'Modalidade e Status',
          value: `${activeChampionship.modality} · Encerrado em ${formatClosedDate(activeChampionship.closedAt)}`,
        },
        {
          label: 'Etapas',
          value: `${activeChampionship.stages.length} de ${activeChampionship.plannedStages} (${concludedCount} concluídas)`,
        },
        {
          label: 'Pontuação e Desempate',
          value: `1º ao ${scoringPositions}º lugar (${scoringPositions} a 1 pt) · Desempate: ${isTimeModality ? 'maior tempo total' : 'maior total de cantos'}`,
        },
      ],
      columns: [
        { label: 'Pos.', width: 70, emphasis: 'bold' },
        { label: 'Ave', width: 240, emphasis: 'bold' },
        { label: 'Proprietário', width: 240 },
        { label: isTimeModality ? 'Tempo' : 'Cantos', width: 100, align: 'right' },
        { label: 'Pontos', width: 110, align: 'right', emphasis: 'bold' },
        { label: approvalHeader, width: 120, align: 'right', emphasis: 'emerald' },
      ],
      rows: filteredGeneral.map((r) => [
        `${r.position}º`,
        r.bird.name,
        r.bird.ownerName,
        formatScoreValue(r.totalSongs, activeChampionship.modality),
        `${r.totalPoints} pts`,
        formatPercentPtBr(
          calculateApprovalPercent(r.totalPoints, concludedCount, scoringPositions)
        ),
      ]),
    });
  };

  const handleExportStageCsv = () => {
    if (!activeChampionship || !activeStage) return;
    const headers = [
      'Posição',
      'Estaca',
      'Nome da Ave',
      'Proprietário',
      `${isTimeModality ? 'Tempo' : 'Cantos'} (${part1Minutes} min)`,
      `${isTimeModality ? 'Tempo' : 'Cantos'} (${part2Minutes} min)`,
      'Pontos Ganhos',
    ];
    const rows = filteredStage.map((r) => [
      r.entry.part1Songs >= minPart1ToScore ? `${r.position}º` : '—',
      r.entry.stakeNumber || '—',
      r.bird.name,
      r.bird.ownerName,
      formatScoreValue(r.entry.part1Songs, activeChampionship.modality),
      formatScoreValue(r.entry.part2Songs, activeChampionship.modality),
      r.points,
    ]);
    downloadCsvFile(
      `historico-${activeChampionship.modality.toLowerCase()}-etapa-${String(activeStage.stageNumber).padStart(2, '0')}.csv`,
      headers,
      rows
    );
  };

  if (closedChampionships.length === 0) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
            <Archive className="w-6 h-6 text-slate-500" />
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900">
            Histórico / Encerrados
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Nenhum campeonato foi encerrado ainda. Quando uma temporada for finalizada no Painel através da opção{' '}
            <strong>Encerrar Campeonato</strong>, ela ficará arquivada aqui em modo somente leitura para consulta permanente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Histórico / Encerrados
          </h1>
          <p className="text-xs text-slate-600">
            Arquivo permanente de campeonatos finalizados (somente leitura) com busca por ave ou proprietário.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 self-start sm:self-auto">
          <Lock className="w-3.5 h-3.5" />
          <span>{closedChampionships.length} encerrado(s)</span>
        </span>
      </div>

      {/* Filters Bar: Modality + Year + Bird/Owner Search */}
      <section
        aria-label="Filtros do histórico de campeonatos"
        className="bg-white border border-slate-200 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 print:hidden"
      >
        <div className="sm:col-span-3">
          <label
            htmlFor="history-modality-filter"
            className="block text-[11px] font-semibold text-slate-600 mb-1"
          >
            Modalidade
          </label>
          <select
            id="history-modality-filter"
            value={modalityFilter}
            onChange={(e) =>
              setModalityFilter(e.target.value as 'Todas' | BirdModality)
            }
            className="w-full min-h-[38px] px-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 cursor-pointer"
          >
            <option value="Todas">Todas as modalidades</option>
            {BIRD_MODALITIES.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="history-year-filter"
            className="block text-[11px] font-semibold text-slate-600 mb-1"
          >
            Ano
          </label>
          <select
            id="history-year-filter"
            value={yearFilter === 'Todos' ? 'Todos' : String(yearFilter)}
            onChange={(e) =>
              setYearFilter(
                e.target.value === 'Todos' ? 'Todos' : Number(e.target.value)
              )
            }
            className="w-full min-h-[38px] px-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 cursor-pointer"
          >
            <option value="Todos">Todos os anos</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-7">
          <label
            htmlFor="history-search-input"
            className="block text-[11px] font-semibold text-slate-600 mb-1"
          >
            Buscar por Ave ou Proprietário
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="history-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite o nome da ave ou proprietário..."
              className="w-full min-h-[38px] pl-9 pr-3 py-1 text-xs sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
            />
          </div>
        </div>
      </section>

      {filteredChampionships.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800">
            Nenhum campeonato encerrado corresponde aos filtros atuais.
          </p>
          <button
            type="button"
            onClick={() => {
              setModalityFilter('Todas');
              setYearFilter('Todos');
              setSearchQuery('');
            }}
            className="min-h-[36px] px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          {/* Closed Championships Cards Selector */}
          <section
            aria-label="Campeonatos encerrados encontrados"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 print:hidden"
          >
            {filteredChampionships.map((champ) => {
              const isSelected = activeChampionship?.id === champ.id;
              const summary = championshipSummaries.get(champ.id);
              return (
                <button
                  key={champ.id}
                  type="button"
                  onClick={() => setSelectedChampionshipId(champ.id)}
                  className={`text-left rounded-2xl border p-3 transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                      {champ.modality} · {champ.seasonYear}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                      <Lock className="w-3 h-3" />
                      Encerrado
                    </span>
                  </div>

                  <p className="font-display text-sm font-bold text-slate-900 truncate">
                    {champ.name}
                  </p>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
                      <strong className="text-slate-800 truncate">
                        {summary?.championName ?? '—'}
                      </strong>
                      {summary && summary.championPoints > 0 && (
                        <span className="font-mono tabular-nums text-emerald-800 font-semibold">
                          ({summary.championPoints} pts)
                        </span>
                      )}
                    </span>
                    <span className="font-mono tabular-nums shrink-0 text-slate-500">
                      {champ.stages.length}/{champ.plannedStages} et.
                    </span>
                  </div>
                </button>
              );
            })}
          </section>

          {/* Selected Archived Championship Read-Only Detail */}
          {activeChampionship && (
            <div className="space-y-3">
              {/* Read-Only Banner & Championship Rules Header */}
              <section className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    {activeChampionship.eventLogoDataUrl && (
                      <img
                        src={activeChampionship.eventLogoDataUrl}
                        alt={`Logotipo ${activeChampionship.name}`}
                        className="w-11 h-11 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                          {activeChampionship.modality}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Somente Leitura
                        </span>
                      </div>
                      <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                        {activeChampionship.name}
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Temporada {activeChampionship.seasonYear} · Encerrado em{' '}
                        {formatClosedDate(activeChampionship.closedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Sub-Tab Switcher */}
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start print:hidden">
                    <button
                      type="button"
                      onClick={() => setSubTab('final')}
                      className={`min-h-[36px] px-3 py-1 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        subTab === 'final'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Classificação Final</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubTab('etapas')}
                      className={`min-h-[36px] px-3 py-1 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        subTab === 'etapas'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CalendarDays className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Por Etapa ({orderedStages.length})</span>
                    </button>
                  </div>
                </div>

                {/* Modality Rules Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Etapas Realizadas
                    </p>
                    <p className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                      {activeChampionship.stages.length} de {activeChampionship.plannedStages} ({concludedCount} concluídas)
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Aves Participantes
                    </p>
                    <p className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                      {activeChampionship.birds.length} cadastradas
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Tempos da Modalidade
                    </p>
                    <p className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                      {part1Minutes} min / {part2Minutes} min
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Pontuação
                    </p>
                    <p className="mt-0.5 font-medium text-slate-800">
                      1º ao {scoringPositions}º ({scoringPositions} a 1 pt)
                    </p>
                  </div>
                </div>
                {activeChampionship.rules.rulesNotes && (
                  <p className="text-[11px] text-slate-600 bg-slate-50/80 border border-slate-200/70 rounded-xl px-3 py-2">
                    <strong className="text-slate-700">Regulamento:</strong>{' '}
                    {activeChampionship.rules.rulesNotes}
                  </p>
                )}
              </section>

              {/* Toolbar for subTab */}
              <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 print:hidden">
                {subTab === 'etapas' && orderedStages.length > 0 && activeStage ? (
                  <div className="flex-1 max-w-lg">
                    <label htmlFor="history-stage-select" className="sr-only">
                      Selecionar etapa encerrada
                    </label>
                    <select
                      id="history-stage-select"
                      value={activeStage.id}
                      onChange={(e) => setSelectedStageId(e.target.value)}
                      className="w-full min-h-[38px] px-3 py-1 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 cursor-pointer"
                    >
                      {orderedStages.map((s) => (
                        <option key={s.id} value={s.id}>
                          Etapa {String(s.stageNumber).padStart(2, '0')} — {s.name} (
                          {formatDatePtBr(s.date)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 px-1">
                    {normalizedSearch
                      ? `Filtrando resultados por "${searchQuery.trim()}"`
                      : `Classificação geral final consolidada · Desempate por ${isTimeModality ? 'maior tempo total' : 'maior total de cantos'}`}
                  </p>
                )}

                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2">
                  <MemberFilterControl
                    value={memberFilter}
                    onChange={setMemberFilter}
                    counts={subTab === 'etapas' ? stageCounts : generalCounts}
                  />

                  {subTab === 'final' ? (
                    <div className="inline-flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleExportFinalPng()}
                        disabled={filteredGeneral.length === 0}
                        className="min-h-[38px] px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl cursor-pointer"
                      >
                        <ImageDown className="w-3.5 h-3.5 text-emerald-700" />
                        <span>PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExportFinalExcel}
                        disabled={filteredGeneral.length === 0}
                        className="min-h-[38px] px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        disabled={filteredGeneral.length === 0}
                        aria-label="Imprimir histórico"
                        className="min-h-[38px] px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleExportStageCsv}
                      disabled={filteredStage.length === 0}
                      className="min-h-[38px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV da Etapa</span>
                    </button>
                  )}
                </div>
              </div>

              {subTab === 'final' ? (
                <>
                  {filteredGeneral.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
                      Nenhuma ave ou proprietário encontrado para os filtros aplicados.
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                              <th className="py-2.5 px-3 w-16">Pos.</th>
                              <th className="py-2.5 px-3">Ave</th>
                              <th className="py-2.5 px-3 hidden lg:table-cell">Proprietário</th>
                              <th className="py-2.5 px-3 text-right">
                                {isTimeModality ? 'Tempo' : 'Cantos'}
                              </th>
                              <th className="py-2.5 px-3 text-right">Pontos</th>
                              <th className="py-2.5 px-3 text-right whitespace-nowrap">
                                Aprov.
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                            {filteredGeneral.map((row) => {
                              const isExpanded = expandedBirdId === row.bird.id;
                              const rowPercent = calculateApprovalPercent(
                                row.totalPoints,
                                concludedCount,
                                scoringPositions
                              );
                              return (
                                <Fragment key={row.bird.id}>
                                  <tr
                                    onClick={() =>
                                      setExpandedBirdId(isExpanded ? null : row.bird.id)
                                    }
                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                                  >
                                    <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900">
                                      {row.position}º
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                                      <span className="inline-flex items-center gap-1">
                                        <span>{row.bird.name}</span>
                                        {row.stageBreakdowns.length > 0 &&
                                          (isExpanded ? (
                                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                          ) : (
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                          ))}
                                      </span>
                                      <span className="block lg:hidden text-[11px] font-normal text-slate-500">
                                        {row.bird.ownerName}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-700 hidden lg:table-cell">
                                      {row.bird.ownerName}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                      {formatScoreValue(row.totalSongs, activeChampionship.modality)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                      {row.totalPoints} pts
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-800 whitespace-nowrap">
                                      {formatPercentPtBr(rowPercent)}
                                    </td>
                                  </tr>
                                  {isExpanded && row.stageBreakdowns.length > 0 && (
                                    <tr className="bg-emerald-50/30">
                                      <td colSpan={6} className="px-4 py-2.5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                          {row.stageBreakdowns.map((b) => (
                                            <div
                                              key={b.stageId}
                                              className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                                            >
                                              <div className="min-w-0">
                                                <p className="font-semibold text-emerald-950 truncate">
                                                  Etapa {String(b.stageNumber).padStart(2, '0')} ·{' '}
                                                  {b.part1Songs >= minPart1ToScore
                                                    ? `${b.position}º`
                                                    : '—'}
                                                </p>
                                                <p className="text-emerald-800/80 font-mono tabular-nums text-[11px]">
                                                  {part1Minutes}m:{' '}
                                                  {formatScoreValue(b.part1Songs, activeChampionship.modality)}{' '}
                                                  · {part2Minutes}m:{' '}
                                                  {formatScoreValue(b.part2Songs, activeChampionship.modality)}
                                                </p>
                                              </div>
                                              <span className="font-mono tabular-nums font-bold text-emerald-900 shrink-0">
                                                {b.part1Songs >= minPart1ToScore
                                                  ? `+${b.points} pts`
                                                  : '—'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <ul className="sm:hidden divide-y divide-slate-100">
                        {filteredGeneral.map((row) => {
                          const isExpanded = expandedBirdId === row.bird.id;
                          const rowPercent = calculateApprovalPercent(
                            row.totalPoints,
                            concludedCount,
                            scoringPositions
                          );
                          return (
                            <li key={row.bird.id} className="p-3 space-y-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBirdId(isExpanded ? null : row.bird.id)
                                }
                                className="w-full text-left flex items-start justify-between gap-2 cursor-pointer"
                              >
                                <div className="flex items-baseline gap-2 min-w-0">
                                  <span className="font-mono tabular-nums text-base font-bold text-slate-900 shrink-0">
                                    {row.position}º
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-display text-sm font-bold text-slate-900 truncate">
                                      {row.bird.name}
                                    </p>
                                    <p className="text-[11px] text-slate-600 truncate">
                                      {row.bird.ownerName}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-mono tabular-nums text-sm font-bold text-emerald-800">
                                    {formatPercentPtBr(rowPercent)}
                                  </p>
                                  <p className="font-mono tabular-nums text-[11px] font-semibold text-slate-700">
                                    {row.totalPoints} pts
                                  </p>
                                </div>
                              </button>
                              {isExpanded && row.stageBreakdowns.length > 0 && (
                                <div className="pt-2 space-y-1.5 border-t border-emerald-100">
                                  {row.stageBreakdowns.map((b) => (
                                    <div
                                      key={b.stageId}
                                      className="flex items-center justify-between text-[11px] bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2"
                                    >
                                      <span className="text-emerald-950 font-medium">
                                        E{String(b.stageNumber).padStart(2, '0')} (
                                        {b.part1Songs >= minPart1ToScore
                                          ? `${b.position}º`
                                          : '—'}
                                        ) · {formatScoreValue(b.part1Songs, activeChampionship.modality)} /{' '}
                                        {formatScoreValue(b.part2Songs, activeChampionship.modality)}
                                      </span>
                                      <span className="font-mono font-bold text-emerald-900">
                                        {b.part1Songs >= minPart1ToScore
                                          ? `+${b.points} pts`
                                          : '—'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <BirdEvolutionChart
                    birds={activeChampionship.birds}
                    stages={activeChampionship.stages}
                    entries={activeChampionship.entries}
                    generalRanking={generalRanking}
                    modality={activeChampionship.modality}
                    part1Minutes={part1Minutes}
                    part2Minutes={part2Minutes}
                    scoringPositions={scoringPositions}
                    minPart1ToScore={minPart1ToScore}
                  />

                  <CertificateGeneratorCard
                    championshipName={activeChampionship.name}
                    seasonYear={activeChampionship.seasonYear}
                    modality={activeChampionship.modality}
                    stages={activeChampionship.stages}
                    birds={activeChampionship.birds}
                    entries={activeChampionship.entries}
                    eventLogoDataUrl={activeChampionship.eventLogoDataUrl}
                    readOnly
                    scoringPositions={scoringPositions}
                    minPart1ToScore={minPart1ToScore}
                  />
                </>
              ) : !activeStage ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
                  Nenhuma etapa registrada neste campeonato encerrado.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-sm font-bold text-slate-900">
                        Etapa {String(activeStage.stageNumber).padStart(2, '0')} —{' '}
                        {activeStage.name}
                      </p>
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {formatDatePtBr(activeStage.date)}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      <strong className="text-slate-800">Local:</strong> {activeStage.address} ·{' '}
                      {filteredStage.length} participante(s)
                    </p>
                  </div>

                  {filteredStage.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
                      Nenhum competidor encontrado nesta etapa para os filtros atuais.
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                              <th className="py-2.5 px-3 w-16">Pos.</th>
                              <th className="py-2.5 px-3 w-20">Estaca</th>
                              <th className="py-2.5 px-3">Nome da Ave</th>
                              <th className="py-2.5 px-3 hidden lg:table-cell">Proprietário</th>
                              <th className="py-2.5 px-3 text-right">{part1Minutes}m</th>
                              <th className="py-2.5 px-3 text-right">{part2Minutes}m</th>
                              <th className="py-2.5 px-3 text-right">Pontos</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                            {filteredStage.map((row) => (
                              <tr key={row.entry.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900">
                                  {row.entry.part1Songs >= minPart1ToScore
                                    ? `${row.position}º`
                                    : '—'}
                                </td>
                                <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                                  {row.entry.stakeNumber || '—'}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {row.bird.name}
                                  <span className="block lg:hidden text-[11px] font-normal text-slate-500">
                                    {row.bird.ownerName}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 hidden lg:table-cell">
                                  {row.bird.ownerName}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                                  {formatScoreValue(row.entry.part1Songs, activeChampionship.modality)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {formatScoreValue(row.entry.part2Songs, activeChampionship.modality)}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                    row.entry.part1Songs >= minPart1ToScore
                                      ? 'text-emerald-800'
                                      : 'text-slate-400 font-normal'
                                  }`}
                                >
                                  {row.entry.part1Songs >= minPart1ToScore
                                    ? `${row.points} pts`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <ul className="sm:hidden divide-y divide-slate-100">
                        {filteredStage.map((row) => (
                          <li key={row.entry.id} className="p-3 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-baseline gap-2 min-w-0">
                                <span className="font-mono tabular-nums text-base font-bold text-slate-900">
                                  {row.entry.part1Songs >= minPart1ToScore
                                    ? `${row.position}º`
                                    : '—'}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-display text-sm font-bold text-slate-900 truncate">
                                    {row.bird.name}
                                  </p>
                                  <p className="text-[11px] text-slate-600 truncate">
                                    {row.entry.stakeNumber
                                      ? `Estaca ${row.entry.stakeNumber} · `
                                      : ''}
                                    {row.bird.ownerName}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`font-mono tabular-nums text-sm font-bold shrink-0 ${
                                  row.entry.part1Songs >= minPart1ToScore
                                    ? 'text-emerald-800'
                                    : 'text-slate-400 font-normal'
                                }`}
                              >
                                {row.entry.part1Songs >= minPart1ToScore
                                  ? `${row.points} pts`
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-600">
                              <span>
                                {part1Minutes}m:{' '}
                                <strong className="font-mono tabular-nums text-slate-800">
                                  {formatScoreValue(row.entry.part1Songs, activeChampionship.modality)}
                                </strong>
                              </span>
                              <span>
                                {part2Minutes}m:{' '}
                                <strong className="font-mono tabular-nums text-slate-900">
                                  {formatScoreValue(row.entry.part2Songs, activeChampionship.modality)}
                                </strong>
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
