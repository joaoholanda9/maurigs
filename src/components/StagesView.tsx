import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Hash,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Bird, Stage, StageEntry } from '../types/championship';
import {
  compareStakeNumbers,
  formatDatePtBr,
  getNextAvailableStakeNumber,
} from '../utils/scoring';
import { StakeNumberInput } from './StakeNumberInput';

interface StagesViewProps {
  championshipName: string;
  seasonYear: number;
  plannedStages: number;
  readOnly?: boolean;
  stages: Stage[];
  birds: Bird[];
  entries: StageEntry[];
  onAddStage: (input: {
    stageNumber: number;
    name: string;
    date: string;
    address: string;
  }) => { ok: boolean; error?: string; stage?: Stage };
  onUpdateStage: (
    id: string,
    input: {
      stageNumber: number;
      name: string;
      date: string;
      address: string;
    }
  ) => { ok: boolean; error?: string };
  onDeleteStage: (id: string) => void;
  onOpenStageTournament: (stageId: string) => void;
  onEnrollBird: (stageId: string, birdId: string, stakeNumber?: string) => void;
  onRemoveBirdFromStage: (stageId: string, birdId: string) => void;
  onUpdateStakeNumber: (entryId: string, stakeNumber: string) => void;
}

export function StagesView({
  championshipName,
  seasonYear,
  plannedStages,
  readOnly = false,
  stages,
  birds,
  entries,
  onAddStage,
  onUpdateStage,
  onDeleteStage,
  onOpenStageTournament,
  onEnrollBird,
  onRemoveBirdFromStage,
  onUpdateStakeNumber,
}: StagesViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Estacas modal state
  const [stakesStageId, setStakesStageId] = useState<string | null>(null);
  const [newBirdId, setNewBirdId] = useState<string>('');
  const [newStakeNumber, setNewStakeNumber] = useState<string>('');
  const [sortByStake, setSortByStake] = useState<boolean>(true);

  const [stageNumber, setStageNumber] = useState<number>(1);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const birdMap = useMemo(() => new Map(birds.map((b) => [b.id, b])), [birds]);

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.stageNumber - b.stageNumber),
    [stages]
  );

  const stageStatsMap = useMemo(() => {
    const map = new Map<string, { enrolled: number; withStake: number }>();
    for (const e of entries) {
      const prev = map.get(e.stageId) ?? { enrolled: 0, withStake: 0 };
      prev.enrolled += 1;
      if (e.stakeNumber.trim() !== '') {
        prev.withStake += 1;
      }
      map.set(e.stageId, prev);
    }
    return map;
  }, [entries]);

  const stakesStage = useMemo(
    () => stages.find((s) => s.id === stakesStageId) ?? null,
    [stages, stakesStageId]
  );

  const stakesStageEntries = useMemo(() => {
    if (!stakesStage) return [];
    const list = entries
      .filter((e) => e.stageId === stakesStage.id && birdMap.has(e.birdId))
      .map((entry) => ({
        entry,
        bird: birdMap.get(entry.birdId)!,
      }));

    list.sort((a, b) => {
      if (sortByStake) {
        const cmp = compareStakeNumbers(a.entry.stakeNumber, b.entry.stakeNumber);
        if (cmp !== 0) return cmp;
      }
      return a.bird.name.localeCompare(b.bird.name, 'pt-BR');
    });

    return list;
  }, [stakesStage, entries, birdMap, sortByStake]);

  const nextStakeSuggestion = useMemo(
    () => getNextAvailableStakeNumber(stakesStageEntries.map((i) => i.entry)),
    [stakesStageEntries]
  );

  const duplicateStakeSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { entry } of stakesStageEntries) {
      const s = entry.stakeNumber.trim().toUpperCase();
      if (!s) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [key, count] of counts.entries()) {
      if (count > 1) dups.add(key);
    }
    return dups;
  }, [stakesStageEntries]);

  const unenrolledBirdsForStakes = useMemo(() => {
    const enrolledIds = new Set(stakesStageEntries.map((i) => i.bird.id));
    return birds
      .filter((b) => !enrolledIds.has(b.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [birds, stakesStageEntries]);

  const nextAvailableNumber = useMemo(() => {
    const used = new Set(stages.map((s) => s.stageNumber));
    for (let i = 1; i <= plannedStages; i++) {
      if (!used.has(i)) return i;
    }
    return plannedStages;
  }, [stages, plannedStages]);

  const openCreateModal = () => {
    if (readOnly || stages.length >= plannedStages) return;
    setEditingStage(null);
    setStageNumber(nextAvailableNumber);
    setName(`Etapa ${String(nextAvailableNumber).padStart(2, '0')}`);
    setDate(new Date().toISOString().slice(0, 10));
    setAddress('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (stage: Stage) => {
    if (readOnly) return;
    setEditingStage(stage);
    setStageNumber(stage.stageNumber);
    setName(stage.name);
    setDate(stage.date);
    setAddress(stage.address);
    setFormError(null);
    setModalOpen(true);
  };

  const openStakesModal = (stageId: string) => {
    setStakesStageId(stageId);
    setNewBirdId('');
    setNewStakeNumber('');
  };

  const handleEnrollWithStake = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !stakesStage || !newBirdId) return;
    onEnrollBird(stakesStage.id, newBirdId, newStakeNumber);
    setNewBirdId('');
    setNewStakeNumber('');
  };

  const handleAutoNumberEmptyStakes = () => {
    if (readOnly) return;
    const usedNumbers = new Set(
      stakesStageEntries
        .map((i) => Number.parseInt(i.entry.stakeNumber, 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
    let nextNum = 1;
    for (const item of stakesStageEntries) {
      if (item.entry.stakeNumber.trim() === '') {
        while (usedNumbers.has(nextNum)) nextNum++;
        usedNumbers.add(nextNum);
        onUpdateStakeNumber(item.entry.id, String(nextNum).padStart(2, '0'));
        nextNum++;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!name.trim() || !date || !address.trim()) {
      setFormError('Informe o número/nome, a data e o endereço completo da etapa.');
      return;
    }
    if (stageNumber < 1 || stageNumber > plannedStages) {
      setFormError(`O número da etapa deve estar entre 1 e ${plannedStages}.`);
      return;
    }

    const res = editingStage
      ? onUpdateStage(editingStage.id, { stageNumber, name, date, address })
      : onAddStage({ stageNumber, name, date, address });

    if (!res.ok) {
      setFormError(res.error ?? 'Não foi possível salvar a etapa.');
      return;
    }

    setModalOpen(false);
  };

  const limitReached = stages.length >= plannedStages;

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {readOnly && (
        <div
          role="status"
          className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs text-amber-950"
        >
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Campeonato Encerrado:</strong> A edição, criação e exclusão de etapas e estacas está bloqueada.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 truncate">
            {championshipName} · Temporada {seasonYear}
          </p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Etapas do Campeonato
          </h1>
          <p className="text-xs text-slate-600">
            Até {plannedStages} etapas previstas com edição livre de estacas.{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800">
              {stages.length}/{plannedStages} cadastradas
            </span>
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={openCreateModal}
            disabled={limitReached}
            className="min-h-[40px] px-3.5 py-2 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{limitReached ? `Limite de ${plannedStages} Etapas` : 'Nova Etapa'}</span>
          </button>
        )}
      </div>

      {/* Stage List */}
      {orderedStages.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Nenhuma etapa cadastrada
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Cadastre as etapas da temporada (até {plannedStages} ao longo do ano) com data, endereço e numeração das estacas.
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 min-h-[40px] px-4 py-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Etapa 01</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {orderedStages.map((stage) => {
            const stats = stageStatsMap.get(stage.id) ?? {
              enrolled: 0,
              withStake: 0,
            };
            return (
              <article
                key={stage.id}
                className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500">
                        <span className="font-mono tabular-nums text-emerald-800 font-semibold">
                          Etapa {String(stage.stageNumber).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono tabular-nums">
                          {stats.enrolled} {stats.enrolled === 1 ? 'ave' : 'aves'}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono tabular-nums">
                          {stats.withStake} {stats.withStake === 1 ? 'estaca' : 'estacas'}
                        </span>
                      </p>
                      <h2 className="mt-0.5 font-display text-base font-bold text-slate-900 leading-snug">
                        {stage.name}
                      </h2>
                    </div>

                    {!readOnly && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(stage)}
                          aria-label={`Editar ${stage.name}`}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteId(
                              confirmDeleteId === stage.id ? null : stage.id
                            )
                          }
                          aria-label={`Excluir ${stage.name}`}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono tabular-nums">
                        {formatDatePtBr(stage.date)}
                      </span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{stage.address}</span>
                    </p>
                  </div>
                </div>

                {confirmDeleteId === stage.id ? (
                  <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5">
                    <span className="text-xs font-medium text-red-900">
                      Excluir etapa?
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[34px] px-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                      >
                        Não
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteStage(stage.id);
                          setConfirmDeleteId(null);
                        }}
                        className="min-h-[34px] px-2.5 text-xs font-semibold text-white bg-red-600 rounded-lg cursor-pointer"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openStakesModal(stage.id)}
                      className="min-h-[40px] px-3 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Hash className="w-3.5 h-3.5" />
                      <span>Estacas ({stats.withStake})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenStageTournament(stage.id)}
                      className="min-h-[40px] px-3 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>Abrir Mesa</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Manage Stakes (Estacas) Modal */}
      {stakesStage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Estacas da Etapa ${stakesStage.stageNumber}`}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-2xl max-h-[88vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-slate-900 truncate">
                  Estacas — Etapa {String(stakesStage.stageNumber).padStart(2, '0')}
                </h2>
                <p className="text-xs text-slate-500 truncate">
                  Registre, altere ou exclua o número da estaca de cada ave a qualquer momento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStakesStageId(null)}
                aria-label="Fechar gerenciador de estacas"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Enroll Bird + Optional Stake Form */}
            {!readOnly && (
              <form
                onSubmit={handleEnrollWithStake}
                className="p-4 bg-slate-50/80 border-b border-slate-200 space-y-3 shrink-0"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-6">
                    <label htmlFor="stake-bird-select" className="sr-only">
                      Selecionar ave para inscrever
                    </label>
                    <select
                      id="stake-bird-select"
                      value={newBirdId}
                      onChange={(e) => setNewBirdId(e.target.value)}
                      disabled={unenrolledBirdsForStakes.length === 0}
                      className="w-full min-h-[44px] px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:opacity-50"
                    >
                      <option value="">
                        {unenrolledBirdsForStakes.length === 0
                          ? 'Todas as aves já estão inscritas'
                          : 'Selecionar ave para inscrever...'}
                      </option>
                      {unenrolledBirdsForStakes.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.ownerName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="stake-new-number" className="sr-only">
                      Número da estaca
                    </label>
                    <input
                      id="stake-new-number"
                      type="text"
                      inputMode="numeric"
                      value={newStakeNumber}
                      onChange={(e) => setNewStakeNumber(e.target.value)}
                      placeholder={`Est. ${nextStakeSuggestion} (auto)`}
                      className="w-full min-h-[44px] px-3 py-2 text-sm font-mono uppercase text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={!newBirdId}
                      className="w-full min-h-[44px] px-3 py-2 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 rounded-xl transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

              {stakesStageEntries.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="inline-flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSortByStake(true)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        sortByStake
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ordem de Estaca
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortByStake(false)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        !sortByStake
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ordem Alfabética
                    </button>
                  </div>

                  {!readOnly &&
                    stakesStageEntries.some((i) => i.entry.stakeNumber.trim() === '') && (
                      <button
                        type="button"
                        onClick={handleAutoNumberEmptyStakes}
                        className="min-h-[34px] px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                      >
                        Numerar vazias automaticamente
                      </button>
                    )}
                </div>
              )}

              {duplicateStakeSet.size > 0 && (
                <div className="flex items-center gap-2 p-2.5 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Atenção: existe número de estaca repetido nesta etapa (
                    {Array.from(duplicateStakeSet).join(', ')}). Ajuste abaixo antes do início.
                  </span>
                </div>
              )}
              </form>
            )}

            {/* Editable Stakes List */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {stakesStageEntries.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-600">
                  Nenhuma ave inscrita nesta etapa ainda. Selecione uma ave acima para definir sua estaca.
                </div>
              ) : (
                stakesStageEntries.map(({ entry, bird }) => {
                  const normalized = entry.stakeNumber.trim().toUpperCase();
                  const isDup = normalized !== '' && duplicateStakeSet.has(normalized);
                  return (
                    <div
                      key={entry.id}
                      className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {bird.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          <span>{bird.ownerName}</span>
                          <span aria-hidden="true"> · </span>
                          <span
                            className={
                              bird.isMember
                                ? 'font-medium text-emerald-800'
                                : 'text-slate-500'
                            }
                          >
                            {bird.isMember ? 'Sócio' : 'Não sócio'}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label
                          htmlFor={`stage-stake-${entry.id}`}
                          className="text-xs font-medium text-slate-600"
                        >
                          Estaca
                        </label>
                        <StakeNumberInput
                          id={`stage-stake-${entry.id}`}
                          value={entry.stakeNumber}
                          disabled={readOnly}
                          onCommit={(nextVal) => onUpdateStakeNumber(entry.id, nextVal)}
                          placeholder="—"
                          ariaLabel={`Número da estaca de ${bird.name}`}
                          className={`w-20 min-h-[42px] text-center font-mono tabular-nums text-sm font-bold uppercase rounded-xl border focus:outline-none focus:ring-2 disabled:opacity-70 ${
                            isDup
                              ? 'bg-amber-50 border-amber-400 text-amber-900 focus:ring-amber-600'
                              : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:ring-emerald-700'
                          }`}
                        />

                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => onUpdateStakeNumber(entry.id, '')}
                              disabled={!entry.stakeNumber}
                              title="Excluir número da estaca"
                              aria-label={`Limpar estaca de ${bird.name}`}
                              className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onRemoveBirdFromStage(stakesStage.id, bird.id)}
                              title="Remover ave da etapa"
                              aria-label={`Remover ${bird.name} da etapa`}
                              className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500">
                Alterações são salvas automaticamente.
              </span>
              <button
                type="button"
                onClick={() => setStakesStageId(null)}
                className="min-h-[42px] px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Stage Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingStage ? 'Editar etapa' : 'Cadastrar nova etapa'}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingStage ? 'Editar Etapa' : 'Nova Etapa do Campeonato'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar formulário"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="p-3 text-xs font-medium text-red-900 bg-red-50 border border-red-200 rounded-xl"
                >
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="stage-number"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Nº da Etapa (1–{plannedStages})
                  </label>
                  <input
                    id="stage-number"
                    type="number"
                    min={1}
                    max={plannedStages}
                    required
                    value={stageNumber}
                    onChange={(e) => setStageNumber(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="stage-date"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Data da Etapa
                  </label>
                  <input
                    id="stage-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="stage-name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Nome / Título da Etapa
                </label>
                <input
                  id="stage-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Etapa 04 — Troféu dos Campeões"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label
                  htmlFor="stage-address"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Endereço Completo
                </label>
                <textarea
                  id="stage-address"
                  rows={3}
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, local/ginásio e cidade/UF"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
                >
                  {editingStage ? 'Salvar Etapa' : 'Cadastrar Etapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
