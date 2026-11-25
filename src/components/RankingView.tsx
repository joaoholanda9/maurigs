import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  ImageDown,
  Lock,
  Printer,
  Search,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type {
  Bird,
  BirdModality,
  GeneralRankingRow,
  MemberFilter,
  ModalityRules,
  Stage,
  StageEntry,
} from '../types/championship';
import { exportReportToExcel, exportReportToPng } from '../utils/reportExport';
import {
  calculateApprovalPercent,
  computeGeneralRanking,
  computeStageRanking,
  countConcludedStages,
  filterByMemberStatus,
  formatDatePtBr,
  formatPercentPtBr,
  formatScoreValue,
  getModalityTopLimit,
  isTimeScoredModality,
  MAX_STAGES,
} from '../utils/scoring';
import { BirdEvolutionChart } from './BirdEvolutionChart';
import { CertificateGeneratorCard } from './CertificateGeneratorCard';
import { MemberFilterControl } from './MemberFilterControl';

interface RankingViewProps {
  championshipName: string;
  seasonYear: number;
  modality?: BirdModality;
  plannedStages?: number;
  rules?: ModalityRules;
  readOnly?: boolean;
  stages: Stage[];
  birds: Bird[];
  entries: StageEntry[];
  eventLogoDataUrl?: string;
  onUpdateEventLogo: (logoDataUrl: string | undefined) => void;
  onOpenStageTournament: (stageId: string) => void;
}

type ReportMode = 'general' | 'top' | 'stage';

const FILTER_LABELS: Record<MemberFilter, string> = {
  all: 'Todos os competidores',
  members: 'Apenas Sócios',
  non_members: 'Não Sócios',
};

export function RankingView({
  championshipName,
  seasonYear,
  modality,
  plannedStages = MAX_STAGES,
  rules,
  readOnly = false,
  stages,
  birds,
  entries,
  eventLogoDataUrl,
  onUpdateEventLogo,
  onOpenStageTournament,
}: RankingViewProps) {
  const part1Minutes = rules?.part1Minutes ?? 10;
  const part2Minutes = rules?.part2Minutes ?? 15;
  const scoringPositions = rules?.scoringPositions ?? 30;
  const minPart1ToScore = rules?.minPart1ToScore ?? 1;
  const topLimit = getModalityTopLimit(modality);
  const isTimeModality = isTimeScoredModality(modality);

  const [reportMode, setReportMode] = useState<ReportMode>('general');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBirdId, setExpandedBirdId] = useState<string | null>(null);

  const concludedCount = useMemo(
    () => countConcludedStages(stages, entries, minPart1ToScore),
    [stages, entries, minPart1ToScore]
  );
  const maxDisputedPoints = concludedCount * scoringPositions;
  const approvalHeaderLabel =
    concludedCount > 0 ? `Aprov. (E${concludedCount})` : 'Aprov.';
  const approvalReferenceText =
    concludedCount > 0
      ? `Etapa ${concludedCount} (Teto ${maxDisputedPoints} pts)`
      : 'Aguardando etapa concluída';

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.stageNumber - b.stageNumber),
    [stages]
  );

  const [selectedStageId, setSelectedStageId] = useState<string>(() => {
    return orderedStages[0]?.id ?? '';
  });

  useEffect(() => {
    if (orderedStages.length === 0) {
      if (selectedStageId !== '') setSelectedStageId('');
      return;
    }
    if (!orderedStages.some((s) => s.id === selectedStageId)) {
      setSelectedStageId(orderedStages[0].id);
    }
  }, [orderedStages, selectedStageId]);

  const activeStage = useMemo(() => {
    if (orderedStages.length === 0) return null;
    return orderedStages.find((s) => s.id === selectedStageId) ?? orderedStages[0];
  }, [orderedStages, selectedStageId]);

  const generalRanking: GeneralRankingRow[] = useMemo(
    () =>
      computeGeneralRanking(stages, entries, birds, {
        scoringPositions,
        minPart1ToScore,
      }),
    [stages, entries, birds, scoringPositions, minPart1ToScore]
  );

  const stageRanking = useMemo(() => {
    if (!activeStage) return [];
    return computeStageRanking(activeStage, entries, birds, {
      scoringPositions,
      minPart1ToScore,
    });
  }, [activeStage, entries, birds, scoringPositions, minPart1ToScore]);

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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byMember;
    return byMember.filter(
      (r) =>
        r.bird.name.toLowerCase().includes(q) ||
        r.bird.ownerName.toLowerCase().includes(q)
    );
  }, [generalRanking, memberFilter, searchQuery]);

  const topGeneral = useMemo(
    () => filteredGeneral.slice(0, topLimit),
    [filteredGeneral, topLimit]
  );

  const displayedGeneralRows =
    reportMode === 'top' ? topGeneral : filteredGeneral;

  const filteredStage = useMemo(() => {
    const byMember = filterByMemberStatus(stageRanking, memberFilter);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byMember;
    return byMember.filter(
      (r) =>
        r.bird.name.toLowerCase().includes(q) ||
        r.bird.ownerName.toLowerCase().includes(q) ||
        r.entry.stakeNumber.toLowerCase().includes(q)
    );
  }, [stageRanking, memberFilter, searchQuery]);

  const issuedAtText = useMemo(() => {
    const now = new Date();
    return `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, [reportMode, memberFilter, selectedStageId]);

  const reportTitle =
    reportMode === 'top'
      ? `Relatório dos ${topLimit} Primeiros Colocados no Geral`
      : reportMode === 'general'
        ? 'Ranking Geral Anual'
        : 'Relatório Oficial por Etapa';

  const buildEventExportData = () => {
    const issuedNow = new Date();
    const emittedLabel = `${issuedNow.toLocaleDateString('pt-BR')} às ${issuedNow.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    if (reportMode === 'general' || reportMode === 'top') {
      const targetRows = reportMode === 'top' ? topGeneral : filteredGeneral;
      const metadataRows: (string | number)[][] = [
        ['Evento', championshipName],
        ['Modalidade', modality ?? 'Coleiro'],
        ['Temporada', seasonYear],
        ['Relatório', reportTitle],
        [
          'Etapas do Campeonato',
          `${stages.length} de ${plannedStages} (${concludedCount} concluída${concludedCount === 1 ? '' : 's'})`,
        ],
        ['Competidores no Relatório', targetRows.length],
        ['Filtro Aplicado', FILTER_LABELS[memberFilter]],
        [
          'Critério de Desempate',
          isTimeModality
            ? 'Maior tempo total em todas as etapas'
            : 'Maior número total de cantos em todas as etapas',
        ],
        ['Base de Aproveitamento', approvalReferenceText],
        ['Emitido em', emittedLabel],
      ];

      const headers = [
        'Pos.',
        'Ave',
        'Proprietário',
        isTimeModality ? `Tempo ${part1Minutes}m` : `Cantos ${part1Minutes}m`,
        isTimeModality ? `Tempo ${part2Minutes}m` : `Cantos ${part2Minutes}m`,
        isTimeModality ? 'Tempo Total' : 'Total Cantos',
        'Pontos',
        approvalHeaderLabel,
      ];

      const excelRows = targetRows.map((r) => [
        `${r.position}º`,
        r.bird.name,
        r.bird.ownerName,
        formatScoreValue(r.totalPart1Songs, modality),
        formatScoreValue(r.totalPart2Songs, modality),
        formatScoreValue(r.totalSongs, modality),
        r.totalPoints,
        formatPercentPtBr(
          calculateApprovalPercent(r.totalPoints, concludedCount, scoringPositions)
        ),
      ]);

      return {
        baseFilename:
          reportMode === 'top'
            ? `relatorio-top-${topLimit}-geral`
            : 'ranking-geral-campeonato',
        sheetName:
          reportMode === 'top' ? `Top ${topLimit} Geral` : 'Ranking Geral',
        emittedLabel,
        metadataRows,
        headers,
        excelRows,
        pngColumns: [
          { label: 'Pos.', width: 70, emphasis: 'bold' as const },
          { label: 'Ave', width: 235, emphasis: 'bold' as const },
          { label: 'Proprietário', width: 235 },
          {
            label: isTimeModality ? 'Tempo' : 'Cantos',
            width: 110,
            align: 'right' as const,
          },
          { label: 'Pontos', width: 110, align: 'right' as const, emphasis: 'bold' as const },
          {
            label: approvalHeaderLabel,
            width: 120,
            align: 'right' as const,
            emphasis: 'emerald' as const,
          },
        ],
        pngRows: targetRows.map((r) => [
          `${r.position}º`,
          r.bird.name,
          r.bird.ownerName,
          formatScoreValue(r.totalSongs, modality),
          `${r.totalPoints} pts`,
          formatPercentPtBr(
            calculateApprovalPercent(r.totalPoints, concludedCount, scoringPositions)
          ),
        ]),
        infoBlocks: [
          {
            label: 'Etapas',
            value: `${stages.length} de ${plannedStages} (${concludedCount} concluída${concludedCount === 1 ? '' : 's'})`,
          },
          {
            label: 'Competidores',
            value:
              reportMode === 'top'
                ? `${topGeneral.length} primeiros colocados (de ${filteredGeneral.length})`
                : `${displayedGeneralRows.length} de ${birds.length} aves`,
          },
          {
            label: 'Pontuação e Desempate',
            value: `1º ao ${scoringPositions}º lugar (${scoringPositions} a 1 pt) · Desempate: ${
              isTimeModality ? 'maior tempo total' : 'maior total de cantos'
            } · ${approvalReferenceText}`,
          },
        ],
      };
    }

    if (!activeStage) return null;
    const stageLabel = `Etapa ${String(activeStage.stageNumber).padStart(2, '0')} — ${activeStage.name}`;
    const tieRule =
      activeStage.tiebreakMode === 'manual' ? 'Desempate Manual' : 'Mesma Pontuação';

    const metadataRows: (string | number)[][] = [
      ['Evento', championshipName],
      ['Modalidade', modality ?? 'Coleiro'],
      ['Temporada', seasonYear],
      ['Relatório', reportTitle],
      ['Etapa', stageLabel],
      ['Data da Etapa', formatDatePtBr(activeStage.date)],
      ['Local / Endereço', activeStage.address],
      ['Participantes e Regra', `${filteredStage.length} aves · ${tieRule}`],
      ['Filtro Aplicado', FILTER_LABELS[memberFilter]],
      ['Emitido em', emittedLabel],
    ];

    const headers = [
      'Posição',
      'Estaca',
      'Nome da Ave',
      'Proprietário',
      isTimeModality ? `Tempo (${part1Minutes} min)` : `Cantos (${part1Minutes} min)`,
      isTimeModality ? `Tempo (${part2Minutes} min)` : `Cantos (${part2Minutes} min)`,
      'Pontos Ganhos',
    ];

    const excelRows = filteredStage.map((r) => [
      r.entry.part1Songs >= minPart1ToScore ? `${r.position}º` : '—',
      r.entry.stakeNumber || '—',
      r.bird.name,
      r.bird.ownerName,
      formatScoreValue(r.entry.part1Songs, modality),
      formatScoreValue(r.entry.part2Songs, modality),
      r.points,
    ]);

    return {
      baseFilename: `relatorio-etapa-${String(activeStage.stageNumber).padStart(2, '0')}`,
      sheetName: `Etapa ${String(activeStage.stageNumber).padStart(2, '0')}`,
      emittedLabel,
      metadataRows,
      headers,
      excelRows,
      pngColumns: [
        { label: 'Pos.', width: 70, emphasis: 'bold' as const },
        { label: 'Estaca', width: 80 },
        { label: 'Nome da Ave', width: 230, emphasis: 'bold' as const },
        { label: 'Proprietário', width: 220 },
        { label: `${part1Minutes}m`, width: 85, align: 'right' as const },
        { label: `${part2Minutes}m`, width: 85, align: 'right' as const },
        { label: 'Pontos', width: 110, align: 'right' as const, emphasis: 'emerald' as const },
      ],
      pngRows: filteredStage.map((r) => [
        r.entry.part1Songs >= minPart1ToScore ? `${r.position}º` : '—',
        r.entry.stakeNumber || '—',
        r.bird.name,
        r.bird.ownerName,
        formatScoreValue(r.entry.part1Songs, modality),
        formatScoreValue(r.entry.part2Songs, modality),
        r.entry.part1Songs >= minPart1ToScore ? `${r.points} pts` : '—',
      ]),
      infoBlocks: [
        {
          label: 'Etapa',
          value: `${stageLabel} · Data: ${formatDatePtBr(activeStage.date)}`,
        },
        {
          label: 'Local',
          value: activeStage.address,
        },
        {
          label: 'Participação e Desempate',
          value: `${filteredStage.length} aves participantes · 1º ${part2Minutes}m > 2º ${part1Minutes}m > ${tieRule}`,
        },
      ],
    };
  };

  const handleExportExcel = () => {
    const data = buildEventExportData();
    if (!data) return;
    exportReportToExcel({
      filename: `${data.baseFilename}.xlsx`,
      sheetName: data.sheetName,
      metadataRows: data.metadataRows,
      headers: data.headers,
      rows: data.excelRows,
    });
  };

  const handleExportPng = async () => {
    const data = buildEventExportData();
    if (!data) return;
    await exportReportToPng({
      filename: `${data.baseFilename}.png`,
      championshipName,
      seasonYear,
      reportTitle,
      issuedAtText: data.emittedLabel,
      filterLabel: FILTER_LABELS[memberFilter],
      infoBlocks: data.infoBlocks,
      columns: data.pngColumns,
      rows: data.pngRows,
    });
  };

  return (
    <div className="space-y-3 sm:space-y-3.5">
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800 print:hidden">
          <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <span>
            <strong>Campeonato encerrado:</strong> os rankings e relatórios estão consolidados em modo somente leitura.
          </span>
        </div>
      )}

      {/* Header + Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 print:hidden">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Rankings e Relatórios
          </h1>
          <p className="text-xs text-slate-600">
            Classificação geral, Top {topLimit} e relatórios oficiais ·{' '}
            {isTimeModality
              ? 'Desempate no geral pelo maior tempo total (0:00.0).'
              : 'Desempate no geral pelo total de cantos.'}
          </p>
        </div>

        <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start">
          <button
            type="button"
            onClick={() => setReportMode('general')}
            className={`min-h-[36px] px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              reportMode === 'general'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Geral Anual
          </button>
          <button
            type="button"
            onClick={() => setReportMode('top')}
            className={`min-h-[36px] px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              reportMode === 'top'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Top {topLimit} Geral
          </button>
          <button
            type="button"
            onClick={() => setReportMode('stage')}
            className={`min-h-[36px] px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              reportMode === 'stage'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Por Etapa
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 space-y-2 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          {reportMode === 'stage' && orderedStages.length > 0 && activeStage ? (
            <div className="flex-1 max-w-lg">
              <label htmlFor="report-stage-select" className="sr-only">
                Selecionar etapa para relatório
              </label>
              <select
                id="report-stage-select"
                value={activeStage.id}
                onChange={(e) => setSelectedStageId(e.target.value)}
                className="w-full min-h-[38px] px-3 py-1 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 cursor-pointer"
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
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar ave ou proprietário..."
                aria-label="Filtrar ranking por ave ou proprietário"
                className="w-full min-h-[38px] pl-9 pr-3 py-1 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          )}

          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2">
            <MemberFilterControl
              value={memberFilter}
              onChange={setMemberFilter}
              counts={reportMode === 'stage' ? stageCounts : generalCounts}
            />

            <div className="inline-flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void handleExportPng()}
                disabled={
                  reportMode === 'stage'
                    ? filteredStage.length === 0
                    : displayedGeneralRows.length === 0
                }
                className="min-h-[38px] px-2.5 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ImageDown className="w-3.5 h-3.5 text-emerald-700" />
                <span>PNG</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={
                  reportMode === 'stage'
                    ? filteredStage.length === 0
                    : displayedGeneralRows.length === 0
                }
                className="min-h-[38px] px-2.5 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                disabled={
                  reportMode === 'stage'
                    ? filteredStage.length === 0
                    : displayedGeneralRows.length === 0
                }
                aria-label="Imprimir relatório"
                className="min-h-[38px] px-2.5 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Official Event Header Present in ALL Reports */}
      <section
        aria-label="Cabeçalho com informações do evento"
        className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            {eventLogoDataUrl && (
              <img
                src={eventLogoDataUrl}
                alt={`Logotipo ${championshipName}`}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                {championshipName} · {modality ? `${modality} · ` : ''}Temporada {seasonYear}
              </p>
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {reportTitle}
              </h2>
            </div>
          </div>

          <div className="text-left sm:text-right text-[11px] text-slate-500 shrink-0">
            <p className="font-mono tabular-nums">Emissão: {issuedAtText}</p>
            <p className="font-medium text-slate-700">{FILTER_LABELS[memberFilter]}</p>
          </div>
        </div>

        {reportMode === 'stage' && activeStage ? (
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-sm font-bold text-slate-900">
                Etapa {String(activeStage.stageNumber).padStart(2, '0')} — {activeStage.name}
              </p>
              <span className="font-mono tabular-nums font-semibold text-slate-700">
                {formatDatePtBr(activeStage.date)}
              </span>
            </div>
            <p className="text-slate-700">
              <span className="font-semibold text-slate-800">Local:</span> {activeStage.address}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-slate-600">
              <span>
                <strong className="font-mono tabular-nums text-slate-900">
                  {filteredStage.length}
                </strong>{' '}
                aves participantes ·{' '}
                {activeStage.tiebreakMode === 'manual'
                  ? 'Desempate Manual'
                  : 'Mesma Pontuação'}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onOpenStageTournament(activeStage.id)}
                  className="font-semibold text-emerald-800 hover:underline cursor-pointer print:hidden"
                >
                  Editar estacas e contagens
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Etapas do Campeonato
              </p>
              <p className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                {stages.length} de {plannedStages} ({concludedCount} concluída
                {concludedCount === 1 ? '' : 's'})
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Competidores no Relatório
              </p>
              <p className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">
                {reportMode === 'top'
                  ? `${topGeneral.length} primeiros (de ${filteredGeneral.length})`
                  : `${displayedGeneralRows.length} de ${birds.length} aves`}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Pontuação por Etapa
              </p>
              <p className="mt-0.5 font-medium text-slate-800">
                1º ao {scoringPositions}º lugar ({scoringPositions} a 1 pt)
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Base de Aproveitamento
              </p>
              <p className="mt-0.5 font-mono tabular-nums font-bold text-emerald-800">
                {approvalReferenceText}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Report Content */}
      {reportMode === 'general' || reportMode === 'top' ? (
        displayedGeneralRows.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-600">
              Nenhuma ave encontrada para o relatório com os filtros atuais.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* Tablet & Desktop General / Top 30 Ranking Table */}
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
                      {approvalHeaderLabel}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {displayedGeneralRows.map((row, idx) => {
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
                            {memberFilter !== 'all' && (
                              <span className="ml-1 text-[11px] font-normal text-slate-400">
                                (#{idx + 1})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            <span className="inline-flex items-center gap-1">
                              <span>{row.bird.name}</span>
                              {row.stageBreakdowns.length > 0 &&
                                (isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 text-slate-400 print:hidden" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 print:hidden" />
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
                            {formatScoreValue(row.totalSongs, modality)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                            {row.totalPoints} pts
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-800 whitespace-nowrap">
                            {formatPercentPtBr(rowPercent)}
                          </td>
                        </tr>

                        {isExpanded && row.stageBreakdowns.length > 0 && (
                          <tr key={`${row.bird.id}-detail`} className="bg-emerald-50/30">
                            <td colSpan={6} className="px-4 py-2.5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {row.stageBreakdowns.map((b, bIdx) => {
                                  const cumulativePts = row.stageBreakdowns
                                    .slice(0, bIdx + 1)
                                    .reduce((sum, item) => sum + item.points, 0);
                                  const stagePct = calculateApprovalPercent(
                                    cumulativePts,
                                    b.stageNumber,
                                    scoringPositions
                                  );
                                  return (
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
                                          {part1Minutes}m: {formatScoreValue(b.part1Songs, modality)} ·{' '}
                                          {part2Minutes}m: {formatScoreValue(b.part2Songs, modality)} · Acum:{' '}
                                          {formatPercentPtBr(stagePct)}
                                        </p>
                                      </div>
                                      <span className="font-mono tabular-nums font-bold text-emerald-900 shrink-0">
                                        {b.part1Songs >= minPart1ToScore
                                          ? `+${b.points} pts`
                                          : '—'}
                                      </span>
                                    </div>
                                  );
                                })}
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

            {/* Mobile Compact General / Top 30 Ranking Cards */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {displayedGeneralRows.map((row, idx) => {
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
                        <p className="font-mono tabular-nums text-sm font-bold text-emerald-800 leading-tight">
                          {formatPercentPtBr(rowPercent)}
                        </p>
                        <p className="font-mono tabular-nums text-[11px] font-semibold text-slate-700">
                          {row.totalPoints} pts
                          {memberFilter !== 'all' ? ` · #${idx + 1}` : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>
                        {isTimeModality ? 'Tempo:' : 'Cantos:'}{' '}
                        <strong className="font-mono tabular-nums text-slate-900">
                          {formatScoreValue(row.totalSongs, modality)}
                        </strong>
                      </span>
                      {row.stageBreakdowns.length > 0 && (
                        <span className="text-emerald-800 font-medium print:hidden">
                          {isExpanded ? 'Ocultar' : 'Detalhes'}
                        </span>
                      )}
                    </div>

                    {isExpanded && row.stageBreakdowns.length > 0 && (
                      <div className="pt-2 space-y-1.5 border-t border-emerald-100">
                        {row.stageBreakdowns.map((b, bIdx) => {
                          const cumulativePts = row.stageBreakdowns
                            .slice(0, bIdx + 1)
                            .reduce((sum, item) => sum + item.points, 0);
                          const stagePct = calculateApprovalPercent(
                            cumulativePts,
                            b.stageNumber,
                            scoringPositions
                          );
                          return (
                            <div
                              key={b.stageId}
                              className="flex items-center justify-between text-[11px] bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2"
                            >
                              <span className="text-emerald-950 font-medium">
                                E{String(b.stageNumber).padStart(2, '0')} (
                                {b.part1Songs >= minPart1ToScore ? `${b.position}º` : '—'}) ·{' '}
                                <span className="font-mono text-emerald-800">
                                  {formatScoreValue(b.part1Songs, modality)}/
                                  {formatScoreValue(b.part2Songs, modality)}
                                </span>
                              </span>
                              <span className="font-mono font-bold text-emerald-900">
                                {b.part1Songs >= minPart1ToScore ? `+${b.points} pts` : '—'} ·{' '}
                                {formatPercentPtBr(stagePct)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : !activeStage ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
          Cadastre etapas para visualizar relatórios individuais.
        </div>
      ) : filteredStage.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
          Nenhum competidor registrado nesta etapa para o filtro selecionado.
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
                {filteredStage.map((row, idx) => (
                  <tr key={row.entry.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900">
                      {row.entry.part1Songs >= minPart1ToScore ? `${row.position}º` : '—'}
                      {memberFilter !== 'all' && row.entry.part1Songs >= minPart1ToScore && (
                        <span className="ml-1 text-[11px] font-normal text-slate-400">
                          (#{idx + 1})
                        </span>
                      )}
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
                      {formatScoreValue(row.entry.part1Songs, modality)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatScoreValue(row.entry.part2Songs, modality)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                        row.entry.part1Songs >= minPart1ToScore
                          ? 'text-emerald-800'
                          : 'text-slate-400 font-normal'
                      }`}
                    >
                      {row.entry.part1Songs >= minPart1ToScore ? `${row.points} pts` : '—'}
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
                      {row.entry.part1Songs >= minPart1ToScore ? `${row.position}º` : '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-slate-900 truncate">
                        {row.bird.name}
                      </p>
                      <p className="text-[11px] text-slate-600 truncate">
                        <span className="font-mono font-medium text-slate-800">
                          {row.entry.stakeNumber
                            ? `Estaca ${row.entry.stakeNumber}`
                            : 'Sem estaca'}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{row.bird.ownerName}</span>
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
                    {row.entry.part1Songs >= minPart1ToScore ? `${row.points} pts` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>
                    {part1Minutes}m:{' '}
                    <strong className="font-mono tabular-nums text-slate-800">
                      {formatScoreValue(row.entry.part1Songs, modality)}
                    </strong>
                  </span>
                  <span>
                    {part2Minutes}m:{' '}
                    <strong className="font-mono tabular-nums text-slate-900">
                      {formatScoreValue(row.entry.part2Songs, modality)}
                    </strong>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recharts Bird Score Evolution Line Chart */}
      <BirdEvolutionChart
        birds={birds}
        stages={stages}
        entries={entries}
        generalRanking={generalRanking}
        modality={modality}
        part1Minutes={part1Minutes}
        part2Minutes={part2Minutes}
        scoringPositions={scoringPositions}
        minPart1ToScore={minPart1ToScore}
      />

      {/* Participation Certificates Generator (PNG / PDF) */}
      <CertificateGeneratorCard
        championshipName={championshipName}
        seasonYear={seasonYear}
        modality={modality}
        stages={stages}
        birds={birds}
        entries={entries}
        eventLogoDataUrl={eventLogoDataUrl}
        onUpdateEventLogo={onUpdateEventLogo}
        readOnly={readOnly}
        scoringPositions={scoringPositions}
        minPart1ToScore={minPart1ToScore}
      />
    </div>
  );
}
