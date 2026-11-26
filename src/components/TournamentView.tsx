import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Download,
  Lock,
  Maximize2,
  Plus,
  Search,
  Shuffle,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Bird,
  BirdModality,
  MemberFilter,
  RankedStageEntry,
  Stage,
  StageEntry,
  TiebreakMode,
} from '../types/championship';
import {
  compareStakeNumbers,
  computeStageRanking,
  downloadCsvFile,
  filterByMemberStatus,
  formatDatePtBr,
  formatScoreValue,
  formatTenthsAsTime,
  getDuplicateBirdNameKeys,
  getNextAvailableStakeNumber,
  isTimeScoredModality,
  normalizeBirdName,
} from '../utils/scoring';
import { MemberFilterControl } from './MemberFilterControl';
import { JudgeFocusModal, StageStopwatch, useStageTimer } from './StageStopwatch';
import { StakeNumberInput } from './StakeNumberInput';
import { TimeScoreInput } from './TimeScoreInput';

interface TournamentViewProps {
  championshipName: string;
  seasonYear: number;
  modality?: BirdModality;
  part1Minutes?: number;
  part2Minutes?: number;
  scoringPositions?: number;
  minPart1ToScore?: number;
  readOnly?: boolean;
  stages: Stage[];
  birds: Bird[];
  entries: StageEntry[];
  selectedStageId: string | null;
  onSelectStage: (stageId: string) => void;
  onGoToStages: () => void;
  onGoToBirds: () => void;
  onEnrollBird: (stageId: string, birdId: string, stakeNumber?: string) => void;
  onEnrollMultipleBirds: (stageId: string, birdIds: string[]) => void;
  onRemoveBirdFromStage: (stageId: string, birdId: string) => void;
  onUpdateStakeNumber: (entryId: string, stakeNumber: string) => void;
  onUpdateSongs: (
    entryId: string,
    field: 'part1Songs' | 'part2Songs',
    value: number
  ) => void;
  onIncrementSong: (
    entryId: string,
    field: 'part1Songs' | 'part2Songs',
    delta: number
  ) => void;
  onSetTiebreakMode: (stageId: string, mode: TiebreakMode) => void;
  onSwapTiebreakOrder: (entryIdA: string, entryIdB: string) => void;
  onUpdateManualTiebreakOrder: (entryId: string, order: number) => void;
  onDrawTieGroupRandomly: (entryIds: string[]) => void;
}

type StageSubTab = 'contagem' | 'classificacao';

interface SongCountInputProps {
  id: string;
  value: number;
  ariaLabel: string;
  title?: string;
  className: string;
  disabled?: boolean;
  onChangeValue: (nextValue: number) => void;
  onEnterNext?: () => void;
}

function SongCountInput({
  id,
  value,
  ariaLabel,
  title,
  className,
  disabled = false,
  onChangeValue,
  onEnterNext,
}: SongCountInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [value, isFocused]);

  return (
    <input
      id={id}
      type="number"
      min={0}
      inputMode="numeric"
      aria-label={ariaLabel}
      title={title}
      value={draft}
      disabled={disabled}
      onFocus={(e) => {
        if (disabled) return;
        setIsFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        if (disabled) return;
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === '') {
          onChangeValue(0);
          return;
        }
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) {
          onChangeValue(Math.max(0, parsed));
        }
      }}
      onBlur={() => {
        setIsFocused(false);
        const parsed = Number.parseInt(draft, 10);
        const clean = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        setDraft(String(clean));
        if (!disabled) {
          onChangeValue(clean);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (onEnterNext) {
            onEnterNext();
          } else {
            e.currentTarget.blur();
          }
        }
      }}
      className={className}
    />
  );
}

export function TournamentView({
  championshipName,
  seasonYear,
  modality,
  part1Minutes = 10,
  part2Minutes = 15,
  scoringPositions = 30,
  minPart1ToScore = 1,
  readOnly = false,
  stages,
  birds,
  entries,
  selectedStageId,
  onSelectStage,
  onGoToStages,
  onGoToBirds,
  onEnrollBird,
  onEnrollMultipleBirds,
  onRemoveBirdFromStage,
  onUpdateStakeNumber,
  onUpdateSongs,
  onIncrementSong,
  onSetTiebreakMode,
  onSwapTiebreakOrder,
  onUpdateManualTiebreakOrder,
  onDrawTieGroupRandomly,
}: TournamentViewProps) {
  const isTimeModality = isTimeScoredModality(modality);
  const timer = useStageTimer(part1Minutes, part2Minutes);
  const [subTab, setSubTab] = useState<StageSubTab>('contagem');
  const [contagemOrder, setContagemOrder] = useState<'stake' | 'ranking'>('ranking');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [frozenRankOrder, setFrozenRankOrder] = useState<string[] | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  const [enrollDrawerOpen, setEnrollDrawerOpen] = useState(false);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [judgeModalOpen, setJudgeModalOpen] = useState(false);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.stageNumber - b.stageNumber),
    [stages]
  );

  const currentStage = useMemo(() => {
    if (orderedStages.length === 0) return null;
    return orderedStages.find((s) => s.id === selectedStageId) ?? orderedStages[0];
  }, [orderedStages, selectedStageId]);

  useEffect(() => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setEditingRowId(null);
    setFrozenRankOrder(null);
  }, [currentStage?.id, contagemOrder]);

  // Ranking ordenado: 2ª parte (maior->menor) -> 1ª parte desempate (maior->menor) -> ordem de registro
  const stageRanking: RankedStageEntry[] = useMemo(() => {
    if (!currentStage) return [];
    return computeStageRanking(currentStage, entries, birds, {
      scoringPositions,
      minPart1ToScore,
    });
  }, [currentStage, entries, birds, scoringPositions, minPart1ToScore]);

  const duplicateStakeSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { entry } of stageRanking) {
      const s = entry.stakeNumber.trim().toUpperCase();
      if (!s) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [key, count] of counts.entries()) {
      if (count > 1) dups.add(key);
    }
    return dups;
  }, [stageRanking]);

  const contagemParticipants = useMemo(() => {
    if (contagemOrder === 'stake') {
      return [...stageRanking].sort((a, b) => {
        const stakeCmp = compareStakeNumbers(a.entry.stakeNumber, b.entry.stakeNumber);
        if (stakeCmp !== 0) return stakeCmp;
        return a.bird.name.localeCompare(b.bird.name, 'pt-BR');
      });
    }

    if (editingRowId && frozenRankOrder) {
      const orderIndex = new Map(frozenRankOrder.map((id, idx) => [id, idx]));
      return [...stageRanking].sort((a, b) => {
        const idxA = orderIndex.get(a.entry.id);
        const idxB = orderIndex.get(b.entry.id);
        if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
        if (idxA !== undefined) return -1;
        if (idxB !== undefined) return 1;
        return 0;
      });
    }

    return stageRanking;
  }, [stageRanking, contagemOrder, editingRowId, frozenRankOrder]);

  const handleRowInputsFocus = (entryId: string) => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    if (editingRowId !== entryId) {
      setEditingRowId(entryId);
      setFrozenRankOrder(stageRanking.map((r) => r.entry.id));
    }
  };

  const handleRowInputsBlur = () => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
    }
    blurTimerRef.current = window.setTimeout(() => {
      setEditingRowId(null);
      setFrozenRankOrder(null);
      blurTimerRef.current = null;
    }, 120);
  };

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    if (!q) return contagemParticipants;
    return contagemParticipants.filter(
      ({ bird, entry }) =>
        bird.name.toLowerCase().includes(q) ||
        bird.ownerName.toLowerCase().includes(q) ||
        entry.stakeNumber.toLowerCase().includes(q)
    );
  }, [contagemParticipants, participantSearch]);

  const nextStakeSuggestion = useMemo(
    () => getNextAvailableStakeNumber(stageRanking.map((r) => r.entry)),
    [stageRanking]
  );

  const enrolledBirdIds = useMemo(
    () => new Set(stageRanking.map((p) => p.bird.id)),
    [stageRanking]
  );

  const duplicateNameKeys = useMemo(
    () => getDuplicateBirdNameKeys(birds),
    [birds]
  );

  const availableBirdsToEnroll = useMemo(() => {
    const q = enrollSearch.trim().toLowerCase();
    return birds
      .filter((b) => !enrolledBirdIds.has(b.id))
      .filter((b) => {
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          b.ownerName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [birds, enrolledBirdIds, enrollSearch]);

  const qualifiedStageRanking = useMemo(
    () => stageRanking.filter((r) => r.entry.part1Songs >= minPart1ToScore),
    [stageRanking, minPart1ToScore]
  );

  const pendingPart1Count = stageRanking.length - qualifiedStageRanking.length;

  const rankingCounts = useMemo(
    () => ({
      all: qualifiedStageRanking.length,
      members: qualifiedStageRanking.filter((r) => r.bird.isMember).length,
      nonMembers: qualifiedStageRanking.filter((r) => !r.bird.isMember).length,
    }),
    [qualifiedStageRanking]
  );

  const filteredStageRanking = useMemo(
    () => filterByMemberStatus(qualifiedStageRanking, memberFilter),
    [qualifiedStageRanking, memberFilter]
  );

  const tieGroups = useMemo(() => {
    const map = new Map<string, RankedStageEntry[]>();
    for (const r of qualifiedStageRanking) {
      if (r.isTied) {
        const list = map.get(r.tieGroupKey) ?? [];
        list.push(r);
        map.set(r.tieGroupKey, list);
      }
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      part2: items[0].entry.part2Songs,
      part1: items[0].entry.part1Songs,
      items,
    }));
  }, [qualifiedStageRanking]);

  const openJudgeMode = (entryId?: string) => {
    if (readOnly) return;
    const target = entryId ?? contagemParticipants[0]?.entry.id ?? null;
    setFocusedEntryId(target);
    setJudgeModalOpen(true);
  };

  const handleExportStageCsv = () => {
    if (!currentStage) return;
    const headers = [
      'Posição',
      'Nome da Ave',
      'Proprietário',
      isTimeModality ? `Tempo (${part1Minutes} min)` : `Cantos (${part1Minutes} min)`,
      isTimeModality ? `Tempo (${part2Minutes} min)` : `Cantos (${part2Minutes} min)`,
      'Pontos Ganhos',
    ];
    const rows = filteredStageRanking.map((r) => [
      r.entry.part1Songs >= minPart1ToScore ? `${r.position}º` : '—',
      r.bird.name,
      r.bird.ownerName,
      formatScoreValue(r.entry.part1Songs, modality),
      formatScoreValue(r.entry.part2Songs, modality),
      r.points,
    ]);
    downloadCsvFile(
      `etapa-${String(currentStage.stageNumber).padStart(2, '0')}-classificacao.csv`,
      headers,
      rows
    );
  };

  if (!currentStage) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
          {championshipName} · {modality ? `${modality} · ` : ''}Temporada {seasonYear}
        </p>
        <h1 className="mt-1 font-display text-lg font-bold text-slate-900">
          Nenhuma etapa cadastrada para o torneio
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          {readOnly
            ? 'Este campeonato foi encerrado sem etapas cadastradas.'
            : isTimeModality
              ? 'Cadastre pelo menos uma etapa do campeonato para inscrever as aves e iniciar a marcação de tempo (0:00.0).'
              : 'Cadastre pelo menos uma etapa do campeonato para inscrever as aves e iniciar a contagem de cantos.'}
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={onGoToStages}
            className="mt-4 min-h-[40px] px-4 py-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Etapa</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800">
          <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <span>
            <strong>Campeonato encerrado:</strong> as notas, estacas e regras de desempate estão em modo somente leitura.
          </span>
        </div>
      )}

      {/* Compact Stage Selector + Sub-tabs (leveled) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 truncate">
          {championshipName} · {modality ? `${modality} · ` : ''}Temporada {seasonYear}
        </p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <select
              id="stage-selector"
              aria-label="Etapa selecionada"
              value={currentStage.id}
              onChange={(e) => onSelectStage(e.target.value)}
              className="w-full h-[40px] px-2.5 font-display text-sm sm:text-base font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 cursor-pointer"
            >
              {orderedStages.map((s) => (
                <option key={s.id} value={s.id}>
                  Etapa {String(s.stageNumber).padStart(2, '0')} — {s.name} (
                  {formatDatePtBr(s.date)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 md:inline-flex items-center gap-1 p-0.5 h-[40px] bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
            <button
              type="button"
              onClick={() => setSubTab('contagem')}
              className={`h-full px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'contagem'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Contagem
            </button>
            <button
              type="button"
              onClick={() => setSubTab('classificacao')}
              className={`h-full px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'classificacao'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Classificação ({qualifiedStageRanking.length})
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5 truncate">
          <span className="font-mono tabular-nums text-slate-700">
            {formatDatePtBr(currentStage.date)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{currentStage.address}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-slate-700">
            {stageRanking.length} aves
          </span>
        </p>
      </div>

      {subTab === 'contagem' ? (
        <div className="space-y-2.5">
          {/* Official Countdown Stopwatch */}
          {!readOnly && <StageStopwatch timer={timer} />}

          {/* Compact Participants Toolbar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Buscar entrada, estaca ou ave..."
                aria-label="Filtrar aves inscritas na etapa"
                className="w-full min-h-[38px] pl-8 pr-2.5 py-1 text-xs sm:text-sm text-slate-900 bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            {stageRanking.length > 1 && (
              <div
                role="group"
                aria-label="Ordenação da contagem"
                className="inline-flex items-center gap-0.5 p-0.5 h-[38px] bg-slate-100 rounded-xl border border-slate-200/80 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setContagemOrder('ranking')}
                  className={`h-full px-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    contagemOrder === 'ranking'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Posição
                </button>
                <button
                  type="button"
                  onClick={() => setContagemOrder('stake')}
                  className={`h-full px-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    contagemOrder === 'stake'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Entrada
                </button>
              </div>
            )}

            {!readOnly && stageRanking.length > 0 && (
              <button
                type="button"
                onClick={() => openJudgeMode()}
                title={
                  isTimeModality
                    ? 'Modo Mesa (marcação de tempo em tempo real)'
                    : 'Modo Mesa (+1 Canto em tempo real)'
                }
                className="min-h-[38px] px-2.5 py-1 inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Modo Mesa</span>
              </button>
            )}

            {!readOnly && (
              <button
                type="button"
                onClick={() => setEnrollDrawerOpen(true)}
                className="min-h-[38px] px-3 py-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Inscrever</span>
              </button>
            )}
          </div>

          {duplicateStakeSet.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>
                Estaca duplicada ({Array.from(duplicateStakeSet).join(', ')}). Ajuste abaixo.
              </span>
            </div>
          )}

          {/* Ultra-Compact Competitor Rows */}
          {stageRanking.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
              <h2 className="font-display text-sm sm:text-base font-semibold text-slate-900">
                Nenhuma ave inscrita nesta etapa
              </h2>
              <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
                {readOnly
                  ? 'Nenhuma ave foi inscrita nesta etapa antes do encerramento.'
                  : isTimeModality
                    ? `Inscreva as aves por ordem de entrada. A pontuação (${scoringPositions} a 1 pt) só passa a valer após registrar pelo menos ${formatTenthsAsTime(minPart1ToScore)} nos ${part1Minutes} minutos.`
                    : `Inscreva as aves por ordem de entrada. A pontuação (${scoringPositions} a 1 pt) só passa a valer após registrar pelo menos ${minPart1ToScore} canto(s) nos ${part1Minutes} minutos.`}
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setEnrollDrawerOpen(true)}
                  className="mt-3.5 min-h-[38px] px-4 py-1.5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Inscrever Aves</span>
                </button>
              )}
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center text-xs sm:text-sm text-slate-600">
              Nenhuma ave inscrita corresponde à busca.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {filteredParticipants.map(({ entry, bird, position, points }) => {
                const normalizedStake = entry.stakeNumber.trim().toUpperCase();
                const isDupStake =
                  normalizedStake !== '' && duplicateStakeSet.has(normalizedStake);
                const isQualified = entry.part1Songs >= minPart1ToScore;
                const part2Locked = readOnly || !isQualified;
                const part2LockHint = !isQualified
                  ? isTimeModality
                    ? `Registre primeiro pelo menos ${formatTenthsAsTime(minPart1ToScore)} nos ${part1Minutes}m para validar a pontuação e liberar os ${part2Minutes}m.`
                    : `Registre primeiro pelo menos ${minPart1ToScore} canto(s) nos ${part1Minutes}m para validar a pontuação e liberar os ${part2Minutes}m.`
                  : undefined;
                return (
                  <div
                    key={entry.id}
                    className="px-2.5 py-2 sm:px-3.5 sm:py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    {/* Position, Points, Bird & Stake */}
                    <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-16 shrink-0 leading-tight">
                          <span
                            className={`block font-mono tabular-nums text-xs sm:text-sm font-bold ${
                              isQualified ? 'text-slate-900' : 'text-slate-400'
                            }`}
                          >
                            {isQualified ? `${position}º` : '—'}
                          </span>
                          <span
                            className={`block tabular-nums leading-tight ${
                              isQualified
                                ? 'font-mono text-[11px] font-bold text-red-600'
                                : 'text-[10px] font-medium text-slate-500'
                            }`}
                          >
                            {isQualified
                              ? `${String(points).padStart(2, '0')} pts`
                              : `Aguard. ${part1Minutes}m`}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <p className="font-display text-xs sm:text-sm font-bold text-slate-900 truncate leading-tight">
                            {bird.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate leading-tight">
                            {bird.ownerName}
                            <span aria-hidden="true"> · </span>
                            <span
                              className={
                                bird.isMember ? 'text-emerald-800 font-medium' : ''
                              }
                            >
                              {bird.isMember ? 'Sócio' : 'Não sócio'}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Inline Stake (yellow card) + Remove on mobile */}
                      <div className="flex items-center gap-1 sm:hidden shrink-0">
                        <div
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-xl border ${
                            isDupStake
                              ? 'bg-amber-100 border-amber-500'
                              : 'bg-yellow-50 border-yellow-300'
                          }`}
                        >
                          <span className="text-[10px] font-semibold text-yellow-900">
                            Est.
                          </span>
                          <StakeNumberInput
                            value={entry.stakeNumber}
                            disabled={readOnly}
                            onCommit={(nextVal) => onUpdateStakeNumber(entry.id, nextVal)}
                            placeholder="—"
                            ariaLabel={`Estaca de ${bird.name}`}
                            className={`w-10 min-h-[30px] text-center font-mono tabular-nums text-xs font-bold uppercase rounded-lg border focus:outline-none focus:ring-2 disabled:opacity-75 disabled:cursor-not-allowed ${
                              isDupStake
                                ? 'bg-white border-amber-400 text-amber-900 focus:ring-amber-600'
                                : 'bg-white border-yellow-300 text-slate-900 focus:ring-yellow-500'
                            }`}
                          />
                        </div>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => onRemoveBirdFromStage(currentStage.id, bird.id)}
                            aria-label={`Remover ${bird.name}`}
                            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right Side: Stake yellow card (tablet/desktop) + numeric counts */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <div
                        className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-xl border ${
                          isDupStake
                            ? 'bg-amber-100 border-amber-500'
                            : 'bg-yellow-50 border-yellow-300'
                        }`}
                      >
                        <label
                          htmlFor={`torneio-stake-${entry.id}`}
                          className="text-[11px] font-semibold text-yellow-900 whitespace-nowrap"
                        >
                          Est.
                        </label>
                        <StakeNumberInput
                          id={`torneio-stake-${entry.id}`}
                          value={entry.stakeNumber}
                          disabled={readOnly}
                          onCommit={(nextVal) => onUpdateStakeNumber(entry.id, nextVal)}
                          placeholder="—"
                          ariaLabel={`Número da estaca de ${bird.name}`}
                          className={`w-12 min-h-[34px] text-center font-mono tabular-nums text-xs font-bold uppercase rounded-lg border focus:outline-none focus:ring-2 disabled:opacity-75 disabled:cursor-not-allowed ${
                            isDupStake
                              ? 'bg-white border-amber-400 text-amber-900 focus:ring-amber-600'
                              : 'bg-white border-yellow-300 text-slate-900 focus:ring-yellow-500'
                          }`}
                        />
                      </div>

                      {/* Part 1 & Part 2 Song Count Cards */}
                      <div
                        onFocus={() => handleRowInputsFocus(entry.id)}
                        onBlur={handleRowInputsBlur}
                        className="grid grid-cols-2 gap-1.5 flex-1 sm:flex-none"
                      >
                        <div
                          className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-xl border ${
                            timer.activeRound === 'part1'
                              ? 'bg-emerald-50/50 border-emerald-300'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <label
                            htmlFor={`p1-${entry.id}`}
                            className="text-[11px] font-semibold text-slate-600 whitespace-nowrap"
                          >
                            {part1Minutes}m
                          </label>
                          {isTimeModality ? (
                            <TimeScoreInput
                              id={`p1-${entry.id}`}
                              value={entry.part1Songs}
                              disabled={readOnly}
                              ariaLabel={`Tempo ${part1Minutes} minutos de ${bird.name}`}
                              onChangeValue={(nextVal) =>
                                onUpdateSongs(entry.id, 'part1Songs', nextVal)
                              }
                              onEnterNext={() => {
                                const nextInput = document.getElementById(
                                  `p2-${entry.id}`
                                ) as HTMLInputElement | null;
                                nextInput?.focus();
                                nextInput?.select();
                              }}
                              className="w-20 min-h-[34px] text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:opacity-75 disabled:cursor-not-allowed"
                            />
                          ) : (
                            <SongCountInput
                              id={`p1-${entry.id}`}
                              value={entry.part1Songs}
                              disabled={readOnly}
                              ariaLabel={`Cantos ${part1Minutes} minutos de ${bird.name}`}
                              onChangeValue={(nextVal) =>
                                onUpdateSongs(entry.id, 'part1Songs', nextVal)
                              }
                              onEnterNext={() => {
                                const nextInput = document.getElementById(
                                  `p2-${entry.id}`
                                ) as HTMLInputElement | null;
                                nextInput?.focus();
                                nextInput?.select();
                              }}
                              className="w-16 sm:w-14 min-h-[34px] text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:opacity-75 disabled:cursor-not-allowed"
                            />
                          )}
                        </div>

                        <div
                          title={part2LockHint}
                          className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-xl border transition-colors ${
                            !isQualified
                              ? 'bg-slate-100 border-slate-200 opacity-80'
                              : timer.activeRound === 'part2'
                                ? 'bg-sky-100/80 border-sky-300'
                                : 'bg-sky-50 border-sky-200'
                          }`}
                        >
                          <label
                            htmlFor={`p2-${entry.id}`}
                            className={`text-[11px] font-semibold whitespace-nowrap ${
                              !isQualified ? 'text-slate-400' : 'text-sky-900'
                            }`}
                          >
                            {part2Minutes}m
                          </label>
                          {isTimeModality ? (
                            <TimeScoreInput
                              id={`p2-${entry.id}`}
                              value={entry.part2Songs}
                              disabled={part2Locked}
                              title={part2LockHint}
                              ariaLabel={`Tempo ${part2Minutes} minutos de ${bird.name}`}
                              onChangeValue={(nextVal) =>
                                onUpdateSongs(entry.id, 'part2Songs', nextVal)
                              }
                              className="w-20 min-h-[34px] text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-white border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          ) : (
                            <SongCountInput
                              id={`p2-${entry.id}`}
                              value={entry.part2Songs}
                              disabled={part2Locked}
                              title={part2LockHint}
                              ariaLabel={`Cantos ${part2Minutes} minutos de ${bird.name}`}
                              onChangeValue={(nextVal) =>
                                onUpdateSongs(entry.id, 'part2Songs', nextVal)
                              }
                              className="w-16 sm:w-14 min-h-[34px] text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-white border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                          )}
                        </div>
                      </div>

                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => onRemoveBirdFromStage(currentStage.id, bird.id)}
                          aria-label={`Remover ${bird.name} da etapa`}
                          className="hidden sm:inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Classificação e Desempate */
        <div className="space-y-3">
          {/* Tiebreak Rule & Mode Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div>
                <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
                  Classificação e Desempate
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-600">
                  1º {isTimeModality ? 'Tempo' : 'Cantos'} {part2Minutes}m · 2º{' '}
                  {isTimeModality ? 'Tempo' : 'Cantos'} {part1Minutes}m · 3º Empate total (
                  {currentStage.tiebreakMode === 'manual' ? 'manual' : 'compartilhado'}).
                </p>
              </div>

              {!readOnly && (
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start">
                  <button
                    type="button"
                    onClick={() => onSetTiebreakMode(currentStage.id, 'manual')}
                    className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      currentStage.tiebreakMode === 'manual'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Desempate Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTiebreakMode(currentStage.id, 'shared')}
                    className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      currentStage.tiebreakMode === 'shared'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mesma Pontuação
                  </button>
                </div>
              )}
            </div>

            {tieGroups.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-950">
                    <p className="font-semibold">
                      Empate total ({tieGroups.length}{' '}
                      {tieGroups.length === 1 ? 'grupo' : 'grupos'})
                    </p>
                    <p className="text-amber-900/90">
                      {currentStage.tiebreakMode === 'manual'
                        ? readOnly
                          ? 'Ordem de desempate definida manualmente.'
                          : 'Ajuste a ordem manual abaixo ou sorteie o vencedor.'
                        : 'As aves empatadas recebem a mesma colocação e pontuação.'}
                    </p>
                  </div>
                </div>

                {currentStage.tiebreakMode === 'manual' && !readOnly && (
                  <div className="space-y-2">
                    {tieGroups.map((group) => (
                      <div
                        key={group.key}
                        className="bg-white border border-amber-200/90 rounded-xl p-2.5 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-800">
                            <span className="font-mono tabular-nums">
                              {formatScoreValue(group.part2, modality)}
                            </span>{' '}
                            ({part2Minutes}m) ·{' '}
                            <span className="font-mono tabular-nums">
                              {formatScoreValue(group.part1, modality)}
                            </span>{' '}
                            ({part1Minutes}m)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onDrawTieGroupRandomly(group.items.map((i) => i.entry.id))
                            }
                            className="min-h-[32px] px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Shuffle className="w-3 h-3" />
                            <span>Sortear</span>
                          </button>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {group.items.map((item, idx) => (
                            <div
                              key={item.entry.id}
                              className="py-1.5 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="font-mono tabular-nums text-xs font-bold text-slate-900 mr-1.5">
                                  {item.position}º
                                </span>
                                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                                  {item.bird.name}
                                </span>
                                <span className="ml-1.5 text-[11px] font-mono text-slate-500">
                                  {item.entry.stakeNumber
                                    ? `Est. ${item.entry.stakeNumber}`
                                    : ''}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <label
                                  className="sr-only"
                                  htmlFor={`tie-order-${item.entry.id}`}
                                >
                                  Ordem de desempate
                                </label>
                                <input
                                  id={`tie-order-${item.entry.id}`}
                                  type="number"
                                  min={1}
                                  value={item.entry.manualTiebreakOrder}
                                  onChange={(e) =>
                                    onUpdateManualTiebreakOrder(
                                      item.entry.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-12 min-h-[32px] text-center font-mono tabular-nums text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg"
                                />
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    onSwapTiebreakOrder(
                                      item.entry.id,
                                      group.items[idx - 1].entry.id
                                    )
                                  }
                                  aria-label={`Subir ${item.bird.name}`}
                                  className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === group.items.length - 1}
                                  onClick={() =>
                                    onSwapTiebreakOrder(
                                      item.entry.id,
                                      group.items[idx + 1].entry.id
                                    )
                                  }
                                  aria-label={`Descer ${item.bird.name}`}
                                  className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ranking Filter + Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <MemberFilterControl
              value={memberFilter}
              onChange={setMemberFilter}
              counts={rankingCounts}
            />

            <button
              type="button"
              onClick={handleExportStageCsv}
              disabled={filteredStageRanking.length === 0}
              className="min-h-[38px] px-3 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>

          {pendingPart1Count > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>
                {pendingPart1Count}{' '}
                {pendingPart1Count === 1
                  ? 'ave inscrita ainda aguarda'
                  : 'aves inscritas ainda aguardam'}{' '}
                a marcação obrigatória dos {part1Minutes}m na aba Contagem para validar a pontuação.
              </span>
            </div>
          )}

          {/* Stage Ranking Table */}
          {filteredStageRanking.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-600">
              {qualifiedStageRanking.length === 0 && stageRanking.length > 0
                ? `Nenhuma ave possui marcação válida nos ${part1Minutes}m ainda. Registre pelo menos os ${part1Minutes}m na aba Contagem para pontuar.`
                : 'Nenhum competidor encontrado para esta seleção.'}
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
                      <th className="py-2.5 px-3 text-right">{part1Minutes}m</th>
                      <th className="py-2.5 px-3 text-right">{part2Minutes}m</th>
                      <th className="py-2.5 px-3 text-right">Pontos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {filteredStageRanking.map((row, idx) => (
                      <tr
                        key={row.entry.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-2 px-3 font-mono tabular-nums font-bold text-slate-900">
                          {row.entry.part1Songs >= minPart1ToScore ? `${row.position}º` : '—'}
                          {memberFilter !== 'all' && row.entry.part1Songs >= minPart1ToScore && (
                            <span className="ml-1 text-[11px] font-normal text-slate-400">
                              (#{idx + 1})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {row.bird.name}
                          {row.isTied && (
                            <span className="ml-1.5 text-[11px] font-normal text-amber-700">
                              Empate
                            </span>
                          )}
                          <span className="block lg:hidden text-[11px] font-normal text-slate-500">
                            {row.bird.ownerName}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-700 hidden lg:table-cell">
                          {row.bird.ownerName}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatScoreValue(row.entry.part1Songs, modality)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatScoreValue(row.entry.part2Songs, modality)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                            row.entry.part1Songs >= minPart1ToScore
                              ? 'text-red-600'
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
                {filteredStageRanking.map((row, idx) => (
                  <li key={row.entry.id} className="px-3 py-2.5 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span
                          className={`font-mono tabular-nums text-base font-bold shrink-0 ${
                            row.entry.part1Songs >= minPart1ToScore
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {row.entry.part1Songs >= minPart1ToScore ? `${row.position}º` : '—'}
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
                        <span
                          className={`font-mono tabular-nums text-sm font-bold ${
                            row.entry.part1Songs >= minPart1ToScore
                              ? 'text-red-600'
                              : 'text-slate-400 font-normal'
                          }`}
                        >
                          {row.entry.part1Songs >= minPart1ToScore ? `${row.points} pts` : '—'}
                        </span>
                        {memberFilter !== 'all' && row.entry.part1Songs >= minPart1ToScore && (
                          <p className="text-[10px] font-mono text-slate-400">
                            #{idx + 1} no filtro
                          </p>
                        )}
                      </div>
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
                      {row.isTied && (
                        <span className="font-medium text-amber-700">Empate</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Enroll Birds Modal / Sheet */}
      {!readOnly && enrollDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Inscrever aves na etapa"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Inscrever Aves — Etapa {String(currentStage.stageNumber).padStart(2, '0')}
                </h2>
                <p className="text-xs text-slate-500">
                  {availableBirdsToEnroll.length}{' '}
                  {availableBirdsToEnroll.length === 1
                    ? 'ave disponível'
                    : 'aves disponíveis'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollDrawerOpen(false)}
                aria-label="Fechar inscrição"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100 space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={enrollSearch}
                  onChange={(e) => setEnrollSearch(e.target.value)}
                  placeholder="Buscar ave por nome ou proprietário..."
                  className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              {availableBirdsToEnroll.length > 0 && (
                <p className="text-[11px] text-slate-600">
                  Numeração das estacas definida automaticamente pela entrada de cada ave (próxima:{' '}
                  <strong className="font-mono text-slate-900">#{nextStakeSuggestion}</strong>).
                </p>
              )}

              {availableBirdsToEnroll.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onEnrollMultipleBirds(
                      currentStage.id,
                      availableBirdsToEnroll.map((b) => b.id)
                    )
                  }
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
                >
                  Inscrever todas as {availableBirdsToEnroll.length} aves por ordem de entrada
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {birds.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-slate-600">
                    Nenhuma ave cadastrada no sistema ainda.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollDrawerOpen(false);
                      onGoToBirds();
                    }}
                    className="mt-3 min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-xl cursor-pointer"
                  >
                    Ir para Cadastro de Aves
                  </button>
                </div>
              ) : availableBirdsToEnroll.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  Todas as aves correspondentes já estão inscritas nesta etapa.
                </div>
              ) : (
                availableBirdsToEnroll.map((bird) => (
                  <div
                    key={bird.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate inline-flex items-center gap-1.5 max-w-full">
                        <span className="truncate">{bird.name}</span>
                        {duplicateNameKeys.has(normalizeBirdName(bird.name)) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 rounded-md shrink-0">
                            Mesmo nome
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        <span>{bird.ownerName}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{bird.isMember ? 'Sócio' : 'Não sócio'}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEnrollBird(currentStage.id, bird.id)}
                      className="min-h-[36px] px-3 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Inscrever
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Judge Real-time Modal */}
      {!readOnly && (
        <JudgeFocusModal
          isOpen={judgeModalOpen}
          onClose={() => setJudgeModalOpen(false)}
          modality={modality}
          minPart1ToScore={minPart1ToScore}
          timer={timer}
          items={contagemParticipants.map(({ entry, bird }) => ({ entry, bird }))}
          focusedEntryId={focusedEntryId}
          onSelectEntry={setFocusedEntryId}
          onIncrement={onIncrementSong}
          onUpdateExact={onUpdateSongs}
        />
      )}
    </div>
  );
}
