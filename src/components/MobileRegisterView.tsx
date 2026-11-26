import {
  CalendarDays,
  Check,
  ChevronDown,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bird, BirdModality, Stage, StageEntry } from '../types/championship';
import {
  compareStakeNumbers,
  formatDatePtBr,
  formatScoreValue,
  formatTenthsAsTime,
  getDuplicateBirdNameKeys,
  getNextAvailableStakeNumber,
  isTimeScoredModality,
  normalizeBirdName,
  parseStakeNumeric,
} from '../utils/scoring';
import { StakeNumberInput } from './StakeNumberInput';
import { TimeScoreInput } from './TimeScoreInput';

interface MobileRegisterViewProps {
  championshipName: string;
  seasonYear: number;
  modality?: BirdModality;
  part1Minutes?: number;
  part2Minutes?: number;
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
  onRemoveBirdFromStage: (stageId: string, birdId: string) => void;
  onUpdateStakeNumber: (entryId: string, stakeNumber: string) => void;
  onUpdateSongs: (
    entryId: string,
    field: 'part1Songs' | 'part2Songs',
    value: number
  ) => void;
}

export function MobileRegisterView({
  championshipName,
  seasonYear,
  modality,
  part1Minutes = 10,
  part2Minutes = 15,
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
  onRemoveBirdFromStage,
  onUpdateStakeNumber,
  onUpdateSongs,
}: MobileRegisterViewProps) {
  const isTimeModality = isTimeScoredModality(modality);
  const [stakeFrom, setStakeFrom] = useState<string>('');
  const [stakeTo, setStakeTo] = useState<string>('');
  const [enrollOpen, setEnrollOpen] = useState(false);

  // Active item in list mode (accordion editor)
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [hasUserCollapsed, setHasUserCollapsed] = useState(false);
  const [draftPart1, setDraftPart1] = useState<number>(0);
  const [draftPart2, setDraftPart2] = useState<number>(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const part1InputRef = useRef<HTMLInputElement | null>(null);
  const part2InputRef = useRef<HTMLInputElement | null>(null);

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.stageNumber - b.stageNumber),
    [stages]
  );

  const currentStage = useMemo(() => {
    if (orderedStages.length === 0) return null;
    return orderedStages.find((s) => s.id === selectedStageId) ?? orderedStages[0];
  }, [orderedStages, selectedStageId]);

  const birdMap = useMemo(() => {
    const map = new Map<string, Bird>();
    for (const b of birds) map.set(b.id, b);
    return map;
  }, [birds]);

  const stageItems = useMemo(() => {
    if (!currentStage) return [];
    const list: { entry: StageEntry; bird: Bird; stakeNum: number | null }[] = [];
    for (const entry of entries) {
      if (entry.stageId !== currentStage.id) continue;
      const bird = birdMap.get(entry.birdId);
      if (!bird) continue;
      list.push({
        entry,
        bird,
        stakeNum: parseStakeNumeric(entry.stakeNumber),
      });
    }

    return list.sort((a, b) => {
      const stakeCmp = compareStakeNumbers(a.entry.stakeNumber, b.entry.stakeNumber);
      if (stakeCmp !== 0) return stakeCmp;
      return a.bird.name.localeCompare(b.bird.name, 'pt-BR');
    });
  }, [currentStage, entries, birdMap]);

  const hasRangeFilter = stakeFrom.trim() !== '' || stakeTo.trim() !== '';

  const parsedRange = useMemo(() => {
    const fromVal = stakeFrom.trim() !== '' ? Number.parseInt(stakeFrom, 10) : null;
    const toVal = stakeTo.trim() !== '' ? Number.parseInt(stakeTo, 10) : null;
    const validFrom = fromVal !== null && Number.isFinite(fromVal) ? fromVal : null;
    const validTo = toVal !== null && Number.isFinite(toVal) ? toVal : null;

    if (validFrom !== null && validTo !== null) {
      return {
        min: Math.min(validFrom, validTo),
        max: Math.max(validFrom, validTo),
      };
    }
    return {
      min: validFrom,
      max: validTo,
    };
  }, [stakeFrom, stakeTo]);

  const filteredItems = useMemo(() => {
    if (parsedRange.min === null && parsedRange.max === null) {
      return stageItems;
    }
    return stageItems.filter(({ stakeNum }) => {
      if (stakeNum === null) return false;
      if (parsedRange.min !== null && stakeNum < parsedRange.min) return false;
      if (parsedRange.max !== null && stakeNum > parsedRange.max) return false;
      return true;
    });
  }, [stageItems, parsedRange]);

  const enrolledBirdIds = useMemo(
    () => new Set(stageItems.map((i) => i.bird.id)),
    [stageItems]
  );

  const duplicateNameKeys = useMemo(
    () => getDuplicateBirdNameKeys(birds),
    [birds]
  );

  const availableBirds = useMemo(
    () =>
      birds
        .filter((b) => !enrolledBirdIds.has(b.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [birds, enrolledBirdIds]
  );

  const stageNumbersStats = useMemo(() => {
    const nums = stageItems
      .map((i) => i.stakeNum)
      .filter((n): n is number => n !== null);
    if (nums.length === 0) return null;
    return {
      min: Math.min(...nums),
      max: Math.max(...nums),
    };
  }, [stageItems]);

  const nextStakeSuggestion = useMemo(
    () => getNextAvailableStakeNumber(stageItems.map((i) => i.entry)),
    [stageItems]
  );

  // Reset selection when stage changes
  useEffect(() => {
    setHasUserCollapsed(false);
    setConfirmDeleteId(null);
    setSavedNotice(null);
    setActiveEntryId(null);
  }, [currentStage?.id]);

  // Keep active entry synced with filtered list unless user intentionally collapsed it or readOnly
  useEffect(() => {
    if (readOnly) {
      setActiveEntryId(null);
      return;
    }
    if (filteredItems.length === 0) {
      setActiveEntryId(null);
      return;
    }
    const stillVisible = activeEntryId
      ? filteredItems.some((item) => item.entry.id === activeEntryId)
      : false;

    if (!stillVisible && !hasUserCollapsed) {
      const first = filteredItems[0];
      setActiveEntryId(first.entry.id);
      setDraftPart1(first.entry.part1Songs);
      setDraftPart2(first.entry.part2Songs);
      setConfirmDeleteId(null);
    }
  }, [filteredItems, activeEntryId, hasUserCollapsed, readOnly]);

  // Clear saved toast cleanly
  useEffect(() => {
    if (!savedNotice) return;
    const timer = window.setTimeout(() => setSavedNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [savedNotice]);

  const openEntryForEdit = (entry: StageEntry, focusPart1 = false) => {
    if (readOnly) return;
    setHasUserCollapsed(false);
    setActiveEntryId(entry.id);
    setDraftPart1(entry.part1Songs);
    setDraftPart2(entry.part2Songs);
    setConfirmDeleteId(null);

    if (focusPart1) {
      window.setTimeout(() => {
        itemRefs.current[entry.id]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
        part1InputRef.current?.focus();
        part1InputRef.current?.select();
      }, 60);
    }
  };

  const handleSaveAndNext = (currentIndex: number, entry: StageEntry, birdName: string) => {
    const cleanP1 = Math.max(0, Math.floor(Number.isFinite(draftPart1) ? draftPart1 : 0));
    const cleanP2 =
      cleanP1 >= minPart1ToScore
        ? Math.max(0, Math.floor(Number.isFinite(draftPart2) ? draftPart2 : 0))
        : 0;

    onUpdateSongs(entry.id, 'part1Songs', cleanP1);
    onUpdateSongs(entry.id, 'part2Songs', cleanP2);
    setConfirmDeleteId(null);

    const nextItem = filteredItems[currentIndex + 1];
    if (nextItem) {
      setSavedNotice(`${birdName} salvo · Estaca ${nextItem.entry.stakeNumber || '—'}`);
      openEntryForEdit(nextItem.entry, true);
    } else {
      setSavedNotice(`${birdName} salvo · Última ave da lista`);
      setHasUserCollapsed(true);
      setActiveEntryId(null);
    }
  };

  const handleCancelEdit = () => {
    setConfirmDeleteId(null);
    setHasUserCollapsed(true);
    setActiveEntryId(null);
  };

  const handleConfirmDelete = (
    currentIndex: number,
    stageId: string,
    bird: Bird
  ) => {
    const fallbackNext =
      filteredItems[currentIndex + 1] ?? filteredItems[currentIndex - 1] ?? null;

    onRemoveBirdFromStage(stageId, bird.id);
    setConfirmDeleteId(null);
    setSavedNotice(`${bird.name} removida da etapa`);

    if (fallbackNext) {
      setHasUserCollapsed(false);
      setActiveEntryId(fallbackNext.entry.id);
      setDraftPart1(fallbackNext.entry.part1Songs);
      setDraftPart2(fallbackNext.entry.part2Songs);
    } else {
      setActiveEntryId(null);
    }
  };

  if (!currentStage) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
        <CalendarDays className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
          {championshipName} · {modality ? `${modality} · ` : ''}Temporada {seasonYear}
        </p>
        <h1 className="mt-1 font-display text-lg font-bold text-slate-900">
          Registro Mobile
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          {readOnly
            ? 'Este campeonato foi encerrado sem etapas cadastradas.'
            : isTimeModality
              ? 'Cadastre pelo menos uma etapa do campeonato para iniciar o registro de tempos (0:00.0) por estaca no celular.'
              : 'Cadastre pelo menos uma etapa do campeonato para iniciar o registro de cantos por estaca no celular.'}
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
    <div className="space-y-3">
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800">
          <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <span>
            <strong>Campeonato encerrado:</strong> o registro por estaca está em modo somente leitura.
          </span>
        </div>
      )}

      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 truncate">
            {championshipName} · {modality ? `${modality} · ` : ''}Temporada {seasonYear}
          </p>
          <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
            Registro Mobile
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 truncate">
            {readOnly
              ? 'Visualização por ordem de estaca.'
              : 'Modo listado por ordem de estaca com salvamento rápido.'}
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setEnrollOpen(true)}
            className="min-h-[40px] px-3.5 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Inscrever</span>
          </button>
        )}
      </div>

      {/* Stage Selector + Stake Interval Filter */}
      <section
        aria-label="Filtros de etapa e intervalo de estacas"
        className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2.5"
      >
        <div>
          <label
            htmlFor="mobile-reg-stage"
            className="block text-[11px] font-semibold text-slate-600 mb-1"
          >
            Etapa do Campeonato
          </label>
          <select
            id="mobile-reg-stage"
            value={currentStage.id}
            onChange={(e) => onSelectStage(e.target.value)}
            className="w-full min-h-[42px] px-2.5 py-1 font-display text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 cursor-pointer"
          >
            {orderedStages.map((s) => (
              <option key={s.id} value={s.id}>
                Etapa {String(s.stageNumber).padStart(2, '0')} — {s.name} (
                {formatDatePtBr(s.date)})
              </option>
            ))}
          </select>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Intervalo de Estacas
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              {filteredItems.length} de {stageItems.length}{' '}
              {stageItems.length === 1 ? 'ave' : 'aves'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5">
              <label
                htmlFor="stake-range-from"
                className="text-xs font-medium text-slate-600 shrink-0"
              >
                De
              </label>
              <input
                id="stake-range-from"
                type="number"
                min={0}
                inputMode="numeric"
                value={stakeFrom}
                onChange={(e) => setStakeFrom(e.target.value)}
                placeholder={stageNumbersStats ? String(stageNumbersStats.min) : '1'}
                className="w-full min-h-[40px] px-2 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex-1 flex items-center gap-1.5">
              <label
                htmlFor="stake-range-to"
                className="text-xs font-medium text-slate-600 shrink-0"
              >
                Até
              </label>
              <input
                id="stake-range-to"
                type="number"
                min={0}
                inputMode="numeric"
                value={stakeTo}
                onChange={(e) => setStakeTo(e.target.value)}
                placeholder={stageNumbersStats ? String(stageNumbersStats.max) : '30'}
                className="w-full min-h-[40px] px-2 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            {hasRangeFilter && (
              <button
                type="button"
                onClick={() => {
                  setStakeFrom('');
                  setStakeTo('');
                }}
                aria-label="Limpar intervalo de estacas"
                className="min-h-[40px] px-2.5 inline-flex items-center justify-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Todas</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {savedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-900"
        >
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="truncate">{savedNotice}</span>
        </div>
      )}

      {/* List Mode */}
      {stageItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Nenhuma ave inscrita nesta etapa
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {readOnly
              ? 'Nenhuma ave foi inscrita nesta etapa antes do encerramento.'
              : isTimeModality
                ? 'Inscreva as aves participantes para registrar estacas e tempos (0:00.0).'
                : 'Inscreva as aves participantes para registrar estacas e cantos.'}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setEnrollOpen(true)}
              className="mt-3.5 min-h-[40px] px-4 py-2 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Inscrever Ave</span>
            </button>
          )}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center space-y-2">
          <p className="text-sm font-medium text-slate-800">
            Nenhuma estaca encontrada no intervalo informado.
          </p>
          <button
            type="button"
            onClick={() => {
              setStakeFrom('');
              setStakeTo('');
            }}
            className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl cursor-pointer"
          >
            Mostrar todas as estacas
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5" role="list" aria-label="Lista de aves da etapa">
          {filteredItems.map(({ entry, bird }, index) => {
            const isActive = activeEntryId === entry.id;
            const isQualified = entry.part1Songs >= minPart1ToScore;
            const isDraftPart1Valid = draftPart1 >= minPart1ToScore;
            const savedTotal = isQualified ? entry.part1Songs + entry.part2Songs : 0;
            const draftTotal = isDraftPart1Valid ? draftPart1 + draftPart2 : draftPart1;

            if (!isActive || readOnly) {
              return (
                <div
                  key={entry.id}
                  role="listitem"
                  ref={(el) => {
                    itemRefs.current[entry.id] = el;
                  }}
                >
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => openEntryForEdit(entry, true)}
                    className={`w-full min-h-[60px] bg-white border border-slate-200 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-3 text-left transition-colors ${
                      readOnly
                        ? 'cursor-default'
                        : 'hover:border-emerald-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex flex-col items-center justify-center shrink-0">
                        <span className="font-mono tabular-nums text-sm font-bold text-amber-950 leading-none">
                          {entry.stakeNumber || '—'}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm sm:text-base font-bold text-slate-900 truncate">
                          {bird.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {bird.ownerName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right font-mono tabular-nums text-xs leading-tight">
                        <div className="text-slate-600">
                          <span className="text-emerald-800 font-semibold">{part1Minutes}m: </span>
                          <span className="font-bold text-emerald-900">
                            {formatScoreValue(entry.part1Songs, modality)}
                          </span>
                          <span className="text-slate-300 mx-1">·</span>
                          <span className="text-sky-800 font-semibold">{part2Minutes}m: </span>
                          <span className="font-bold text-sky-900">
                            {formatScoreValue(entry.part2Songs, modality)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {isQualified ? (
                            <>
                              Total:{' '}
                              <span className="font-bold text-slate-900">
                                {formatScoreValue(savedTotal, modality)}
                              </span>
                            </>
                          ) : (
                            <span className="text-amber-700 font-semibold">
                              Aguard. {part1Minutes}m
                            </span>
                          )}
                        </div>
                      </div>
                      {!readOnly && <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                    </div>
                  </button>
                </div>
              );
            }

            return (
              <article
                key={entry.id}
                role="listitem"
                ref={(el) => {
                  itemRefs.current[entry.id] = el;
                }}
                className="bg-white border-2 border-emerald-600/80 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-xs"
              >
                {/* Estaca + Bird Name + Owner Name */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="shrink-0">
                      <label
                        htmlFor={`mobile-stake-${entry.id}`}
                        className="block text-[11px] font-semibold text-amber-900 mb-1"
                      >
                        Estaca
                      </label>
                      <StakeNumberInput
                        id={`mobile-stake-${entry.id}`}
                        value={entry.stakeNumber}
                        onCommit={(nextVal) => onUpdateStakeNumber(entry.id, nextVal)}
                        placeholder="—"
                        ariaLabel={`Número da estaca de ${bird.name}`}
                        className="w-16 min-h-[44px] px-2 text-center font-mono tabular-nums text-base font-bold uppercase text-amber-950 bg-amber-100 border border-amber-300 rounded-xl focus:outline-none focus:bg-amber-50 focus:ring-2 focus:ring-amber-600"
                      />
                    </div>

                    <div className="min-w-0 flex-1 pt-3.5">
                      <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 leading-snug truncate">
                        {bird.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 leading-snug truncate">
                        {bird.ownerName}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono tabular-nums font-medium text-slate-400 shrink-0 pt-0.5">
                    {index + 1}/{filteredItems.length}
                  </span>
                </div>

                {/* Parte 1 (Verde) e Parte 2 (Azul) */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Parte 1 */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor={`mobile-p1-${entry.id}`}
                      className="block text-xs font-semibold text-emerald-800"
                    >
                      {isTimeModality
                        ? `Tempo ${part1Minutes} min`
                        : `Cantos ${part1Minutes} min`}
                    </label>
                    <div className="flex items-center min-h-[50px] bg-emerald-50 border border-emerald-300 rounded-xl focus-within:border-emerald-700 focus-within:ring-1 focus-within:ring-emerald-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setDraftPart1((prev) => Math.max(0, prev - 1))}
                        aria-label={
                          isTimeModality
                            ? `Diminuir 0.1s do tempo ${part1Minutes} min de ${bird.name}`
                            : `Diminuir cantos ${part1Minutes} min de ${bird.name}`
                        }
                        className="min-h-[48px] w-9 sm:w-10 inline-flex items-center justify-center text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 shrink-0 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      {isTimeModality ? (
                        <TimeScoreInput
                          ref={part1InputRef}
                          id={`mobile-p1-${entry.id}`}
                          value={draftPart1}
                          ariaLabel={`Tempo ${part1Minutes} minutos de ${bird.name}`}
                          onChangeValue={(nextTenths) => setDraftPart1(nextTenths)}
                          onEnterNext={() => {
                            part2InputRef.current?.focus();
                            part2InputRef.current?.select();
                          }}
                          className="w-full min-w-0 min-h-[48px] text-center font-mono tabular-nums text-lg sm:text-xl font-bold text-emerald-950 bg-transparent focus:outline-none"
                        />
                      ) : (
                        <input
                          ref={part1InputRef}
                          id={`mobile-p1-${entry.id}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          aria-label={`Cantos ${part1Minutes} minutos de ${bird.name}`}
                          value={draftPart1}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const parsed = Number.parseInt(e.target.value, 10);
                            setDraftPart1(
                              Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              part2InputRef.current?.focus();
                              part2InputRef.current?.select();
                            }
                          }}
                          className="w-full min-w-0 min-h-[48px] text-center font-mono tabular-nums text-xl sm:text-2xl font-bold text-emerald-950 bg-transparent focus:outline-none"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setDraftPart1((prev) => prev + 1)}
                        aria-label={
                          isTimeModality
                            ? `Somar 0.1s ao tempo ${part1Minutes} min de ${bird.name}`
                            : `Somar cantos ${part1Minutes} min de ${bird.name}`
                        }
                        className="min-h-[48px] w-9 sm:w-10 inline-flex items-center justify-center text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Parte 2 */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor={`mobile-p2-${entry.id}`}
                      className={`block text-xs font-semibold ${
                        isDraftPart1Valid ? 'text-sky-800' : 'text-slate-400'
                      }`}
                    >
                      {isTimeModality
                        ? `Tempo ${part2Minutes} min`
                        : `Cantos ${part2Minutes} min`}
                    </label>
                    <div
                      className={`flex items-center min-h-[50px] rounded-xl overflow-hidden border ${
                        isDraftPart1Valid
                          ? 'bg-sky-50 border-sky-300 focus-within:border-sky-700 focus-within:ring-1 focus-within:ring-sky-700'
                          : 'bg-slate-100 border-slate-200 opacity-75'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!isDraftPart1Valid}
                        onClick={() => setDraftPart2((prev) => Math.max(0, prev - 1))}
                        aria-label={
                          isTimeModality
                            ? `Diminuir 0.1s do tempo ${part2Minutes} min de ${bird.name}`
                            : `Diminuir cantos ${part2Minutes} min de ${bird.name}`
                        }
                        className="min-h-[48px] w-9 sm:w-10 inline-flex items-center justify-center text-sky-700 hover:bg-sky-100 active:bg-sky-200 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed shrink-0 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      {isTimeModality ? (
                        <TimeScoreInput
                          ref={part2InputRef}
                          id={`mobile-p2-${entry.id}`}
                          value={draftPart2}
                          disabled={!isDraftPart1Valid}
                          ariaLabel={`Tempo ${part2Minutes} minutos de ${bird.name}`}
                          onChangeValue={(nextTenths) => setDraftPart2(nextTenths)}
                          onEnterNext={() => handleSaveAndNext(index, entry, bird.name)}
                          className="w-full min-w-0 min-h-[48px] text-center font-mono tabular-nums text-lg sm:text-xl font-bold text-sky-950 bg-transparent focus:outline-none disabled:text-slate-400 disabled:cursor-not-allowed"
                        />
                      ) : (
                        <input
                          ref={part2InputRef}
                          id={`mobile-p2-${entry.id}`}
                          type="number"
                          min={0}
                          inputMode="numeric"
                          disabled={!isDraftPart1Valid}
                          aria-label={`Cantos ${part2Minutes} minutos de ${bird.name}`}
                          value={draftPart2}
                          onFocus={(e) => {
                            if (isDraftPart1Valid) e.currentTarget.select();
                          }}
                          onChange={(e) => {
                            if (!isDraftPart1Valid) return;
                            const parsed = Number.parseInt(e.target.value, 10);
                            setDraftPart2(
                              Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveAndNext(index, entry, bird.name);
                            }
                          }}
                          className="w-full min-w-0 min-h-[48px] text-center font-mono tabular-nums text-xl sm:text-2xl font-bold text-sky-950 bg-transparent focus:outline-none disabled:text-slate-400 disabled:cursor-not-allowed"
                        />
                      )}
                      <button
                        type="button"
                        disabled={!isDraftPart1Valid}
                        onClick={() => setDraftPart2((prev) => prev + 1)}
                        aria-label={
                          isTimeModality
                            ? `Somar 0.1s ao tempo ${part2Minutes} min de ${bird.name}`
                            : `Somar cantos ${part2Minutes} min de ${bird.name}`
                        }
                        className="min-h-[48px] w-9 sm:w-10 inline-flex items-center justify-center text-sky-700 hover:bg-sky-100 active:bg-sky-200 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {!isDraftPart1Valid && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-center font-medium">
                    Registre pelo menos os {part1Minutes} min para validar a pontuação e liberar os {part2Minutes} min.
                  </p>
                )}

                {/* Total */}
                <p className="text-sm text-slate-600 text-center">
                  {isTimeModality ? 'Tempo total:' : 'Total:'}{' '}
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    {isTimeModality ? formatTenthsAsTime(draftTotal) : draftTotal}
                  </span>
                  {!isTimeModality && (draftTotal === 1 ? ' canto' : ' cantos')}
                </p>

                {/* Primary & Secondary Actions */}
                {confirmDeleteId === entry.id ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2.5">
                    <p className="text-xs font-semibold text-red-900 text-center">
                      Remover {bird.name} (Estaca {entry.stakeNumber || '—'}) desta etapa?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[42px] px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap cursor-pointer"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfirmDelete(index, currentStage.id, bird)
                        }
                        className="min-h-[42px] px-3 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl whitespace-nowrap cursor-pointer"
                      >
                        Confirmar Exclusão
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleSaveAndNext(index, entry, bird.name)}
                      className="w-full min-h-[48px] px-4 py-2.5 inline-flex items-center justify-center gap-2 text-sm sm:text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs active:scale-[0.99] transition-all whitespace-nowrap cursor-pointer"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Salvar e Próximo</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="min-h-[44px] px-3 py-2 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap cursor-pointer"
                      >
                        <X className="w-4 h-4 shrink-0" />
                        <span>Cancelar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(entry.id)}
                        className="min-h-[44px] px-3 py-2 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Quick Enroll Modal */}
      {!readOnly && enrollOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Inscrever ave na etapa"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-md max-h-[82vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-slate-900 truncate">
                  Inscrever — Etapa {String(currentStage.stageNumber).padStart(2, '0')}
                </h2>
                <p className="text-xs text-slate-500">
                  {availableBirds.length}{' '}
                  {availableBirds.length === 1 ? 'ave disponível' : 'aves disponíveis'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollOpen(false)}
                aria-label="Fechar"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {availableBirds.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 shrink-0">
                <p className="text-[11px] text-slate-600">
                  Numeração das estacas pela entrada de cada ave (próxima:{' '}
                  <strong className="font-mono text-slate-900">#{nextStakeSuggestion}</strong>).
                </p>
              </div>
            )}

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {birds.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-slate-600">
                    Nenhuma ave cadastrada ainda.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollOpen(false);
                      onGoToBirds();
                    }}
                    className="mt-3 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-xl cursor-pointer"
                  >
                    Ir para Aves
                  </button>
                </div>
              ) : availableBirds.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-600">
                  Todas as aves cadastradas já estão inscritas nesta etapa.
                </div>
              ) : (
                availableBirds.map((bird) => (
                  <div
                    key={bird.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate inline-flex items-center gap-1.5 max-w-full">
                        <span className="truncate">{bird.name}</span>
                        {duplicateNameKeys.has(normalizeBirdName(bird.name)) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 rounded-md shrink-0">
                            Mesmo nome
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {bird.ownerName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEnrollBird(currentStage.id, bird.id)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl shrink-0 cursor-pointer"
                    >
                      + Inscrever
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
