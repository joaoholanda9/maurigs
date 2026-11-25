import {
  AlertTriangle,
  FileText,
  ImageDown,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Bird, BirdModality, MemberFilter, Stage, StageEntry } from '../types/championship';
import {
  exportBirdStatsToPdf,
  exportBirdStatsToPng,
  type BirdStatsExportData,
} from '../utils/birdStatsExport';
import {
  calculateApprovalPercent,
  computeGeneralRanking,
  computeStageRanking,
  countConcludedStages,
  findBirdsWithSameName,
  formatAverageScoreValue,
  formatDatePtBr,
  formatPercentPtBr,
  formatScoreValue,
  getDuplicateBirdNameKeys,
  isTimeScoredModality,
  normalizeBirdName,
} from '../utils/scoring';
import { MemberFilterControl } from './MemberFilterControl';

interface BirdsViewProps {
  championshipName: string;
  seasonYear: number;
  modality?: BirdModality;
  part1Minutes?: number;
  part2Minutes?: number;
  scoringPositions?: number;
  minPart1ToScore?: number;
  readOnly?: boolean;
  birds: Bird[];
  stages: Stage[];
  entries: StageEntry[];
  eventLogoDataUrl?: string;
  onAddBird: (input: {
    name: string;
    ownerName: string;
    isMember: boolean;
  }) => { ok: boolean; error?: string };
  onUpdateBird: (
    id: string,
    input: {
      name: string;
      ownerName: string;
      isMember: boolean;
    }
  ) => { ok: boolean; error?: string };
  onDeleteBird: (id: string) => void;
}

function formatAvg(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatNowPtBr(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
}

export function BirdsView({
  championshipName,
  seasonYear,
  modality,
  part1Minutes = 10,
  part2Minutes = 15,
  scoringPositions = 30,
  minPart1ToScore = 1,
  readOnly = false,
  birds,
  stages,
  entries,
  eventLogoDataUrl,
  onAddBird,
  onUpdateBird,
  onDeleteBird,
}: BirdsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBird, setEditingBird] = useState<Bird | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [performanceBirdId, setPerformanceBirdId] = useState<string | null>(null);
  const [exportingStatsType, setExportingStatsType] = useState<'png' | 'pdf' | null>(
    null
  );
  const [exportStatsError, setExportStatsError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [isMember, setIsMember] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSameName, setConfirmSameName] = useState(false);
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);

  const isTimeModality = isTimeScoredModality(modality);

  const duplicateNameKeys = useMemo(
    () => getDuplicateBirdNameKeys(birds),
    [birds]
  );

  const sameNameMatches = useMemo(
    () => findBirdsWithSameName(birds, name, editingBird?.id),
    [birds, name, editingBird?.id]
  );

  const counts = useMemo(
    () => ({
      all: birds.length,
      members: birds.filter((b) => b.isMember).length,
      nonMembers: birds.filter((b) => !b.isMember).length,
    }),
    [birds]
  );

  const filteredBirds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return birds
      .filter((b) => {
        if (onlyDuplicates && duplicateNameKeys.size > 0) {
          if (!duplicateNameKeys.has(normalizeBirdName(b.name))) return false;
        }
        if (memberFilter === 'members' && !b.isMember) return false;
        if (memberFilter === 'non_members' && b.isMember) return false;
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          b.ownerName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [birds, searchQuery, memberFilter, onlyDuplicates, duplicateNameKeys]);

  const performanceBird = useMemo(
    () => birds.find((b) => b.id === performanceBirdId) ?? null,
    [birds, performanceBirdId]
  );

  const concludedStagesCount = useMemo(
    () => countConcludedStages(stages, entries, minPart1ToScore),
    [stages, entries, minPart1ToScore]
  );

  const generalRanking = useMemo(
    () =>
      computeGeneralRanking(stages, entries, birds, {
        scoringPositions,
        minPart1ToScore,
      }),
    [stages, entries, birds, scoringPositions, minPart1ToScore]
  );

  const birdSeasonPerformance = useMemo(() => {
    if (!performanceBird) return null;
    const orderedStages = [...stages].sort((a, b) => a.stageNumber - b.stageNumber);

    const stageRows = orderedStages.map((stage) => {
      const ranked = computeStageRanking(stage, entries, birds, {
        scoringPositions,
        minPart1ToScore,
      });
      const found = ranked.find((r) => r.bird.id === performanceBird.id);
      return {
        stage,
        participated: Boolean(found),
        position:
          found && found.entry.part1Songs >= minPart1ToScore ? found.position : null,
        points: found?.points ?? 0,
        stakeNumber: found?.entry.stakeNumber ?? '',
        part1Songs: found?.entry.part1Songs ?? 0,
        part2Songs: found?.entry.part2Songs ?? 0,
      };
    });

    const totalPoints = stageRows.reduce((acc, r) => acc + r.points, 0);
    const stagesDisputed = stageRows.filter((r) => r.participated).length;
    const scoredStagesCount = stageRows.filter((r) => r.points > 0).length;
    const totalPart1 = stageRows.reduce((acc, r) => acc + r.part1Songs, 0);
    const totalPart2 = stageRows.reduce((acc, r) => acc + r.part2Songs, 0);
    const totalSongs = totalPart1 + totalPart2;

    const stagesWithRecordedSongs = stageRows.filter(
      (r) => r.participated && (r.part1Songs > 0 || r.part2Songs > 0)
    ).length;
    const avgDivisor = stagesWithRecordedSongs || stagesDisputed;
    const avgPart1 = avgDivisor > 0 ? totalPart1 / avgDivisor : 0;
    const avgPart2 = avgDivisor > 0 ? totalPart2 / avgDivisor : 0;
    const avgPoints = avgDivisor > 0 ? totalPoints / avgDivisor : 0;

    let bestPart1: { songs: number; stageNumber: number | null } = {
      songs: 0,
      stageNumber: null,
    };
    let bestPart2: { songs: number; stageNumber: number | null } = {
      songs: 0,
      stageNumber: null,
    };
    let bestPosition: { position: number | null; stageNumber: number | null } = {
      position: null,
      stageNumber: null,
    };
    let podiumsCount = 0;
    let firstPlacesCount = 0;

    for (const row of stageRows) {
      if (!row.participated) continue;
      if (row.part1Songs > bestPart1.songs) {
        bestPart1 = { songs: row.part1Songs, stageNumber: row.stage.stageNumber };
      }
      if (row.part2Songs > bestPart2.songs) {
        bestPart2 = { songs: row.part2Songs, stageNumber: row.stage.stageNumber };
      }
      if (row.position !== null) {
        if (
          bestPosition.position === null ||
          row.position < bestPosition.position
        ) {
          bestPosition = {
            position: row.position,
            stageNumber: row.stage.stageNumber,
          };
        }
        if (row.position <= 3) podiumsCount += 1;
        if (row.position === 1) firstPlacesCount += 1;
      }
    }

    const approvalPercent =
      concludedStagesCount > 0
        ? calculateApprovalPercent(
            totalPoints,
            concludedStagesCount,
            scoringPositions
          )
        : 0;
    const rankingRow =
      generalRanking.find((r) => r.bird.id === performanceBird.id) ?? null;

    return {
      currentPosition: rankingRow?.position ?? null,
      totalRankedBirds: generalRanking.length,
      stageRows,
      totalPoints,
      stagesDisputed,
      scoredStagesCount,
      totalPart1,
      totalPart2,
      totalSongs,
      avgPart1,
      avgPart2,
      avgPoints,
      bestPart1,
      bestPart2,
      bestPosition,
      podiumsCount,
      firstPlacesCount,
      approvalPercent,
    };
  }, [
    performanceBird,
    stages,
    entries,
    birds,
    concludedStagesCount,
    generalRanking,
    scoringPositions,
    minPart1ToScore,
  ]);

  const buildBirdStatsExportData = (): BirdStatsExportData | null => {
    if (!performanceBird || !birdSeasonPerformance) return null;
    return {
      championshipName,
      seasonYear,
      modality,
      part1Minutes,
      part2Minutes,
      birdName: performanceBird.name,
      ownerName: performanceBird.ownerName,
      isMember: performanceBird.isMember,
      currentPosition: birdSeasonPerformance.currentPosition,
      totalRankedBirds: birdSeasonPerformance.totalRankedBirds,
      totalPoints: birdSeasonPerformance.totalPoints,
      approvalPercent: birdSeasonPerformance.approvalPercent,
      concludedStagesCount,
      stagesDisputed: birdSeasonPerformance.stagesDisputed,
      scoredStagesCount: birdSeasonPerformance.scoredStagesCount,
      totalPart1: birdSeasonPerformance.totalPart1,
      totalPart2: birdSeasonPerformance.totalPart2,
      totalSongs: birdSeasonPerformance.totalSongs,
      avgPart1: birdSeasonPerformance.avgPart1,
      avgPart2: birdSeasonPerformance.avgPart2,
      avgPoints: birdSeasonPerformance.avgPoints,
      bestPart1: birdSeasonPerformance.bestPart1,
      bestPart2: birdSeasonPerformance.bestPart2,
      bestPosition: birdSeasonPerformance.bestPosition,
      podiumsCount: birdSeasonPerformance.podiumsCount,
      firstPlacesCount: birdSeasonPerformance.firstPlacesCount,
      stageRows: birdSeasonPerformance.stageRows.map((row) => ({
        stageNumber: row.stage.stageNumber,
        stageName: row.stage.name,
        date: row.stage.date,
        participated: row.participated,
        stakeNumber: row.stakeNumber,
        position: row.position,
        points: row.points,
        part1Songs: row.part1Songs,
        part2Songs: row.part2Songs,
      })),
      issuedAtText: formatNowPtBr(),
      eventLogoDataUrl,
    };
  };

  const handleExportBirdStats = async (format: 'png' | 'pdf') => {
    const payload = buildBirdStatsExportData();
    if (!payload || exportingStatsType) return;

    setExportStatsError(null);
    setExportingStatsType(format);
    try {
      if (format === 'png') {
        await exportBirdStatsToPng(payload);
      } else {
        await exportBirdStatsToPdf(payload);
      }
    } catch (err) {
      setExportStatsError(
        err instanceof Error
          ? err.message
          : 'Não foi possível exportar as estatísticas da ave.'
      );
    } finally {
      setExportingStatsType(null);
    }
  };

  const openCreateModal = () => {
    if (readOnly) return;
    setEditingBird(null);
    setName('');
    setOwnerName('');
    setIsMember(true);
    setFormError(null);
    setConfirmSameName(false);
    setModalOpen(true);
  };

  const openEditModal = (bird: Bird) => {
    if (readOnly) return;
    setEditingBird(bird);
    setName(bird.name);
    setOwnerName(bird.ownerName);
    setIsMember(bird.isMember);
    setFormError(null);
    setConfirmSameName(false);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!name.trim() || !ownerName.trim()) {
      setFormError('Preencha o nome da ave e o nome do proprietário.');
      return;
    }

    if (sameNameMatches.length > 0 && !confirmSameName) {
      setConfirmSameName(true);
      return;
    }

    const result = editingBird
      ? onUpdateBird(editingBird.id, { name, ownerName, isMember })
      : onAddBird({ name, ownerName, isMember });

    if (!result.ok) {
      setFormError(result.error ?? 'Erro ao salvar cadastro.');
      return;
    }

    setConfirmSameName(false);
    setModalOpen(false);
  };

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs text-slate-800">
          <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <span>
            <strong>Campeonato encerrado:</strong> o cadastro de aves está em modo somente leitura. Toque em uma ave para consultar ou exportar a ficha estatística.
          </span>
        </div>
      )}

      {/* Compact Page Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 truncate">
            {championshipName} · {modality ? `${modality} · ` : ''}Temporada {seasonYear}
          </p>
          <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
            Aves e Competidores
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 truncate">
            Toque no nome da ave para ver o desempenho anual.
          </p>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[38px] px-3 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Ave</span>
          </button>
        )}
      </div>

      {/* Compact Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar ave ou proprietário..."
            aria-label="Buscar aves por nome ou proprietário"
            className="w-full min-h-[38px] pl-8 pr-3 py-1 text-xs sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
          />
        </div>

        <MemberFilterControl
          value={memberFilter}
          onChange={setMemberFilter}
          counts={counts}
        />
      </div>

      {duplicateNameKeys.size > 0 && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950"
        >
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>Atenção:</strong> há{' '}
              <span className="font-mono font-bold">{duplicateNameKeys.size}</span>{' '}
              {duplicateNameKeys.size === 1
                ? 'nome de ave repetido'
                : 'nomes de aves repetidos'}{' '}
              neste campeonato. Confira o proprietário antes de inscrever nas etapas.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOnlyDuplicates((prev) => !prev)}
            className="self-start sm:self-auto min-h-[32px] px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-amber-100/70 text-amber-950 border border-amber-300 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            {onlyDuplicates ? 'Mostrar todas' : 'Filtrar repetidos'}
          </button>
        </div>
      )}

      {/* Empty State or Compact List */}
      {birds.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Nenhuma ave cadastrada
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {readOnly
              ? 'Nenhuma ave foi cadastrada neste campeonato antes do encerramento.'
              : 'Cadastre os competidores informando o nome da ave, o proprietário e se é sócio da instituição.'}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-3.5 min-h-[38px] px-4 py-1.5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeira Ave</span>
            </button>
          )}
        </div>
      ) : filteredBirds.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
          <p className="text-xs sm:text-sm font-medium text-slate-800">
            Nenhuma ave encontrada para o filtro atual.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setMemberFilter('all');
            }}
            className="mt-2 min-h-[34px] px-3 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Tablet & Desktop Compact Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-600">
                  <th className="py-2 px-3">Nome da Ave</th>
                  <th className="py-2 px-3">Proprietário</th>
                  <th className="py-2 px-3">Vínculo</th>
                  {!readOnly && <th className="py-2 px-3 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredBirds.map((bird) => (
                  <tr key={bird.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-1.5 px-3">
                      <button
                        type="button"
                        onClick={() => {
                          setExportStatsError(null);
                          setPerformanceBirdId(bird.id);
                        }}
                        className="font-semibold text-slate-900 hover:text-emerald-800 hover:underline text-left cursor-pointer inline-flex items-center gap-1.5 flex-wrap"
                      >
                        <span>{bird.name}</span>
                        {duplicateNameKeys.has(normalizeBirdName(bird.name)) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            Nome repetido
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-1.5 px-3 text-slate-700">{bird.ownerName}</td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span
                        className={
                          bird.isMember
                            ? 'font-medium text-emerald-800'
                            : 'text-slate-600'
                        }
                      >
                        {bird.isMember ? 'Sócio' : 'Não sócio'}
                      </span>
                    </td>
                    {!readOnly && (
                      <td className="py-1 px-3 text-right">
                        {confirmDeleteId === bird.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-600">Excluir?</span>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteBird(bird.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(bird)}
                              aria-label={`Editar ${bird.name}`}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(bird.id)}
                              aria-label={`Excluir ${bird.name}`}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Ultra-Compact Rows */}
          <ul className="sm:hidden divide-y divide-slate-100">
            {filteredBirds.map((bird) => (
              <li key={bird.id} className="px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setExportStatsError(null);
                        setPerformanceBirdId(bird.id);
                      }}
                      className="font-display text-sm font-bold text-slate-900 hover:text-emerald-800 hover:underline text-left cursor-pointer inline-flex items-center gap-1.5 flex-wrap max-w-full"
                    >
                      <span className="truncate">{bird.name}</span>
                      {duplicateNameKeys.has(normalizeBirdName(bird.name)) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 rounded-md shrink-0">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                          Mesmo nome
                        </span>
                      )}
                    </button>
                    <p className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-1.5 leading-tight">
                      <span className="truncate">{bird.ownerName}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          bird.isMember
                            ? 'font-semibold text-emerald-800'
                            : 'text-slate-500'
                        }
                      >
                        {bird.isMember ? 'Sócio' : 'Não sócio'}
                      </span>
                    </p>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(bird)}
                        aria-label={`Editar ${bird.name}`}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteId(confirmDeleteId === bird.id ? null : bird.id)
                        }
                        aria-label={`Excluir ${bird.name}`}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {!readOnly && confirmDeleteId === bird.id && (
                  <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200 rounded-xl p-2">
                    <span className="text-[11px] font-medium text-red-900">
                      Remover ave e notas?
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[32px] px-2.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                      >
                        Não
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteBird(bird.id);
                          setConfirmDeleteId(null);
                        }}
                        className="min-h-[32px] px-2.5 text-[11px] font-semibold text-white bg-red-600 rounded-lg cursor-pointer"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bird Annual Performance Modal (Full Statistics + PNG / PDF Export) */}
      {performanceBird && birdSeasonPerformance && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Estatísticas completas de ${performanceBird.name}`}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 shrink-0" />

            <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 truncate">
                  {championshipName} · {seasonYear} · Ficha Estatística
                </p>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                  {performanceBird.name}
                </h2>
                <p className="text-xs text-slate-600 truncate">
                  <span>{performanceBird.ownerName}</span>
                  <span aria-hidden="true"> · </span>
                  <span
                    className={
                      performanceBird.isMember
                        ? 'font-medium text-emerald-800'
                        : 'text-slate-500'
                    }
                  >
                    {performanceBird.isMember ? 'Sócio' : 'Não sócio'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPerformanceBirdId(null)}
                aria-label="Fechar estatísticas"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Season Summary Cards */}
            <div className="px-4 py-3 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
              <div className="col-span-2 sm:col-span-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-medium text-emerald-800">Colocação Atual</p>
                <p className="font-mono tabular-nums text-sm font-bold text-emerald-950">
                  {birdSeasonPerformance.currentPosition !== null
                    ? `${birdSeasonPerformance.currentPosition}º`
                    : '—'}
                  {birdSeasonPerformance.currentPosition !== null && (
                    <span className="ml-1 text-[11px] font-normal text-emerald-800">
                      de {birdSeasonPerformance.totalRankedBirds}
                    </span>
                  )}
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-medium text-emerald-800">Etapas</p>
                <p className="font-mono tabular-nums text-sm font-bold text-emerald-950">
                  {birdSeasonPerformance.stagesDisputed}
                  <span className="ml-1 text-[10px] font-normal text-emerald-800">
                    ({birdSeasonPerformance.scoredStagesCount} pont.)
                  </span>
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-medium text-emerald-800">Pontos</p>
                <p className="font-mono tabular-nums text-sm font-bold text-emerald-900">
                  {birdSeasonPerformance.totalPoints} pts
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-medium text-emerald-800">
                  {isTimeModality ? 'Tempo Total' : 'Cantos'}
                </p>
                <p className="font-mono tabular-nums text-sm font-bold text-emerald-950">
                  {formatScoreValue(birdSeasonPerformance.totalSongs, modality)}
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <p className="text-[10px] font-medium text-emerald-800">Aprov.</p>
                <p className="font-mono tabular-nums text-sm font-bold text-emerald-900">
                  {formatPercentPtBr(birdSeasonPerformance.approvalPercent)}
                </p>
              </div>
            </div>

            {/* Averages, Records & Stage-by-Stage Breakdown */}
            <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-3">
              {/* Detailed Season Averages & Records */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900 mb-2">
                  Médias, Totais e Recordes na Temporada
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white/90 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-emerald-800">Total {part1Minutes} min</p>
                    <p className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-950">
                      {formatScoreValue(birdSeasonPerformance.totalPart1, modality)}
                      {isTimeModality ? '' : ' cantos'}
                    </p>
                  </div>
                  <div className="bg-white/90 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-emerald-800">Total {part2Minutes} min</p>
                    <p className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-950">
                      {formatScoreValue(birdSeasonPerformance.totalPart2, modality)}
                      {isTimeModality ? '' : ' cantos'}
                    </p>
                  </div>
                  <div className="bg-white/90 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-emerald-800">Média {part1Minutes} min</p>
                    <p className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-950">
                      {formatAverageScoreValue(birdSeasonPerformance.avgPart1, modality)} / etapa
                    </p>
                  </div>
                  <div className="bg-white/90 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-emerald-800">Média {part2Minutes} min</p>
                    <p className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-950">
                      {formatAverageScoreValue(birdSeasonPerformance.avgPart2, modality)} / etapa
                    </p>
                  </div>
                  <div className="bg-white/90 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-emerald-800">Média Pontos</p>
                    <p className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-900">
                      {formatAvg(birdSeasonPerformance.avgPoints)} pts/etapa
                    </p>
                  </div>
                  <div className="bg-white/90 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-emerald-800">Melhor {part1Minutes} min</p>
                    <p className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-950">
                      {birdSeasonPerformance.bestPart1.stageNumber !== null
                        ? `${formatScoreValue(birdSeasonPerformance.bestPart1.songs, modality)} (E${String(birdSeasonPerformance.bestPart1.stageNumber).padStart(2, '0')})`
                        : '—'}
                    </p>
                  </div>
                  <div className="bg-white/90 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-emerald-800">Melhor {part2Minutes} min</p>
                    <p className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-950">
                      {birdSeasonPerformance.bestPart2.stageNumber !== null
                        ? `${formatScoreValue(birdSeasonPerformance.bestPart2.songs, modality)} (E${String(birdSeasonPerformance.bestPart2.stageNumber).padStart(2, '0')})`
                        : '—'}
                    </p>
                  </div>
                  <div className="bg-white/90 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                    <p className="text-[10px] font-medium text-emerald-800">Melhor Pos. / Pódios</p>
                    <p className="font-mono tabular-nums text-xs font-bold text-emerald-950 truncate">
                      {birdSeasonPerformance.bestPosition.position !== null
                        ? `${birdSeasonPerformance.bestPosition.position}º · ${birdSeasonPerformance.podiumsCount} pódio(s) (${birdSeasonPerformance.firstPlacesCount}x 1º)`
                        : 'Sem pódio ainda'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 px-0.5">
                  Histórico Completo Etapa por Etapa
                </p>
                {birdSeasonPerformance.stageRows.length === 0 ? (
                  <div className="p-6 text-center text-xs sm:text-sm text-slate-500">
                    Nenhuma etapa cadastrada na temporada.
                  </div>
                ) : (
                  birdSeasonPerformance.stageRows.map((row) => (
                    <div
                      key={row.stage.id}
                      className={`rounded-xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        row.participated
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-emerald-50/40 border-emerald-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums text-xs font-bold text-emerald-950">
                            Etapa {String(row.stage.stageNumber).padStart(2, '0')}
                          </span>
                          <span className="text-[11px] font-mono text-emerald-800/80">
                            {formatDatePtBr(row.stage.date)}
                          </span>
                          {row.participated && row.stakeNumber && (
                            <span className="text-[11px] font-mono text-emerald-900">
                              · Est. {row.stakeNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-emerald-900/90 truncate">
                          {row.stage.name}
                        </p>
                      </div>

                      {row.participated ? (
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                          <div className="text-left sm:text-right mr-1 leading-tight">
                            <span className="block font-mono tabular-nums text-xs font-bold text-emerald-950">
                              {row.position !== null ? `${row.position}º lugar` : `Aguardando ${part1Minutes}m`}
                            </span>
                            <span className="block font-mono tabular-nums text-[11px] font-semibold text-emerald-800">
                              {row.points > 0 ? `+${row.points} pts` : '—'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 bg-white">
                              <span className="text-[11px] font-semibold text-emerald-800 whitespace-nowrap">
                                {part1Minutes}m
                              </span>
                              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-950">
                                {formatScoreValue(row.part1Songs, modality)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 bg-white">
                              <span className="text-[11px] font-semibold text-emerald-800 whitespace-nowrap">
                                {part2Minutes}m
                              </span>
                              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-950">
                                {formatScoreValue(row.part2Songs, modality)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-700/70 shrink-0">
                          Não participou
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sticky Export Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                {exportStatsError ? (
                  <p role="alert" className="text-[11px] font-medium text-red-700">
                    {exportStatsError}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    {birdSeasonPerformance.stageRows.length} etapa(s) na temporada · Exporte a ficha completa
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  disabled={exportingStatsType !== null}
                  onClick={() => void handleExportBirdStats('png')}
                  className="min-h-[38px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <ImageDown className="w-3.5 h-3.5" />
                  <span>
                    {exportingStatsType === 'png' ? 'Gerando PNG...' : 'Baixar PNG'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={exportingStatsType !== null}
                  onClick={() => void handleExportBirdStats('pdf')}
                  className="min-h-[38px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    {exportingStatsType === 'pdf' ? 'Gerando PDF...' : 'Baixar PDF'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {!readOnly && modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingBird ? 'Editar ave' : 'Cadastrar nova ave'}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingBird ? 'Editar Competidor' : 'Nova Ave Competidora'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar formulário"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
              {formError && (
                <div
                  role="alert"
                  className="p-2.5 text-xs font-medium text-red-900 bg-red-50 border border-red-200 rounded-xl"
                >
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="bird-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nome da Ave
                </label>
                <input
                  id="bird-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (confirmSameName) setConfirmSameName(false);
                    if (formError) setFormError(null);
                  }}
                  placeholder="Ex.: Trovão Dourado"
                  className={`w-full min-h-[40px] px-3 py-1.5 text-sm text-slate-900 bg-slate-50 border rounded-xl focus:outline-none focus:bg-white focus:ring-2 ${
                    sameNameMatches.length > 0
                      ? 'border-amber-400 focus:ring-amber-600'
                      : 'border-slate-200 focus:ring-emerald-700'
                  }`}
                />

                {sameNameMatches.length > 0 && (
                  <div
                    role="alert"
                    className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1.5"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold">
                          Já existe{' '}
                          {sameNameMatches.length === 1
                            ? 'uma ave cadastrada com este nome'
                            : `${sameNameMatches.length} aves cadastradas com este nome`}
                          :
                        </p>
                        <ul className="space-y-0.5 text-[11px] text-amber-900">
                          {sameNameMatches.slice(0, 4).map((match) => (
                            <li key={match.id} className="truncate">
                              • <strong>{match.name}</strong> — Prop.: {match.ownerName} (
                              {match.isMember ? 'Sócio' : 'Não sócio'})
                            </li>
                          ))}
                          {sameNameMatches.length > 4 && (
                            <li>
                              … e mais {sameNameMatches.length - 4} ave(s) com o mesmo nome.
                            </li>
                          )}
                        </ul>
                        <p className="text-[11px] text-amber-900/90">
                          {confirmSameName
                            ? 'Clique em "Confirmar Mesmo Assim" abaixo se desejar manter o nome repetido.'
                            : 'Confira o proprietário para evitar cadastro duplicado.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="bird-owner"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nome do Proprietário
                </label>
                <input
                  id="bird-owner"
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ex.: Carlos Eduardo Mendes"
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1">
                  Proprietário é Sócio da Instituição?
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setIsMember(true)}
                    className={`min-h-[38px] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                      isMember
                        ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sim · Sócio
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMember(false)}
                    className={`min-h-[38px] rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                      !isMember
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Não · Convidado
                  </button>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-semibold text-white rounded-xl cursor-pointer ${
                    sameNameMatches.length > 0 && confirmSameName
                      ? 'bg-amber-700 hover:bg-amber-800'
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {sameNameMatches.length > 0 && confirmSameName
                    ? 'Confirmar Mesmo Assim'
                    : editingBird
                      ? 'Salvar Alterações'
                      : 'Cadastrar Ave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
