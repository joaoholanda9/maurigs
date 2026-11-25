import { useCallback, useEffect, useMemo, useState } from 'react';
import cantoFibraLogo from '../assets/aope-logo.svg';
import {
  createEmptyChampionship,
  createInitialSampleChampionshipRecord,
  createSampleChampionship,
  INITIAL_CHAMPIONSHIP_ID,
  INITIAL_CHAMPIONSHIP_NAME,
} from '../data/seedData';
import type {
  Bird,
  BirdModality,
  Championship,
  ChampionshipState,
  ChampionshipStatus,
  ModalityRules,
  MultiChampionshipState,
  Stage,
  StageEntry,
  StageReminderConfig,
  TiebreakMode,
} from '../types/championship';
import { BIRD_MODALITIES } from '../types/championship';
import {
  compareStakeNumbers,
  getDefaultModalityRules,
  getNextAvailableStakeNumber,
} from '../utils/scoring';

const LEGACY_STORAGE_KEY_V2 = 'canto_anilha_championship_v2';
const STORAGE_KEY_V3 = 'canto_anilha_championship_v3';
const ATTACHMENT_SYNC_KEY = 'canto_anilha_aope_data_sync_20261124_v1';

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeEntries(entries: StageEntry[]): StageEntry[] {
  return entries.map((e) => ({
    ...e,
    stakeNumber: typeof e.stakeNumber === 'string' ? e.stakeNumber : '',
  }));
}

function sanitizeModality(value: unknown): BirdModality {
  if (typeof value === 'string' && (BIRD_MODALITIES as readonly string[]).includes(value)) {
    return value as BirdModality;
  }
  return 'Coleiro';
}

function sanitizeStatus(value: unknown): ChampionshipStatus {
  return value === 'Encerrado' ? 'Encerrado' : 'Em andamento';
}

function sanitizeRules(rules: unknown, modality: BirdModality): ModalityRules {
  const defaults = getDefaultModalityRules(modality);
  if (!rules || typeof rules !== 'object') return defaults;
  const r = rules as Partial<ModalityRules>;
  const p1 = Math.floor(Number(r.part1Minutes));
  const p2 = Math.floor(Number(r.part2Minutes));
  const pos = Math.floor(Number(r.scoringPositions));
  const minP1 = Math.floor(Number(r.minPart1ToScore));
  return {
    part1Minutes: Number.isFinite(p1) && p1 >= 1 && p1 <= 120 ? p1 : defaults.part1Minutes,
    part2Minutes: Number.isFinite(p2) && p2 >= 1 && p2 <= 120 ? p2 : defaults.part2Minutes,
    scoringPositions:
      Number.isFinite(pos) && pos >= 1 && pos <= 100 ? pos : defaults.scoringPositions,
    minPart1ToScore:
      Number.isFinite(minP1) && minP1 >= 1 && minP1 <= 100
        ? minP1
        : defaults.minPart1ToScore,
    rulesNotes:
      typeof r.rulesNotes === 'string' && r.rulesNotes.trim()
        ? r.rulesNotes.trim()
        : defaults.rulesNotes,
  };
}

function sanitizeStageReminder(reminder: unknown): StageReminderConfig {
  if (reminder && typeof reminder === 'object') {
    const r = reminder as Partial<StageReminderConfig>;
    const days = Number(r.daysBefore);
    return {
      enabled: Boolean(r.enabled),
      daysBefore:
        Number.isFinite(days) && days >= 0 && days <= 60 ? Math.floor(days) : 3,
      browserNotification: Boolean(r.browserNotification),
    };
  }
  return {
    enabled: false,
    daysBefore: 3,
    browserNotification: false,
  };
}

export const DEFAULT_EVENT_LOGO_URL = cantoFibraLogo;

function isLegacyGeneratedRasterLogo(trimmed: string): boolean {
  return (
    trimmed.includes('canto_fibra_mark_') ||
    trimmed.includes('canto_fibra_logo_') ||
    trimmed.includes('canto_fibra_emblem_') ||
    trimmed.includes('canto-fibra-logo') ||
    trimmed.includes('Logotipo%20Canto')
  );
}

function sanitizeEventLogo(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isLegacyGeneratedRasterLogo(trimmed)) {
      return cantoFibraLogo;
    }
    if (
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('/src/assets/') ||
      trimmed.startsWith('/assets/') ||
      trimmed === cantoFibraLogo
    ) {
      return trimmed;
    }
  }
  return undefined;
}

function resolveLoadedEventLogo(value: unknown): string {
  if (value === '') return '';
  return sanitizeEventLogo(value) ?? cantoFibraLogo;
}

function sanitizeChampionship(raw: Partial<Championship>): Championship {
  const modality = sanitizeModality(raw.modality);
  const stages = Array.isArray(raw.stages) ? raw.stages : [];
  const birds = Array.isArray(raw.birds) ? raw.birds : [];
  const entries = Array.isArray(raw.entries) ? sanitizeEntries(raw.entries) : [];
  const parsedYear = Math.floor(Number(raw.seasonYear));
  const seasonYear =
    Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : 2026;
  const parsedPlanned = Math.floor(Number(raw.plannedStages));
  const plannedStages =
    Number.isFinite(parsedPlanned) && parsedPlanned >= 1 && parsedPlanned <= 60
      ? Math.max(parsedPlanned, stages.length)
      : Math.max(26, stages.length);

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : generateId('champ'),
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : INITIAL_CHAMPIONSHIP_NAME,
    modality,
    seasonYear,
    plannedStages,
    rules: sanitizeRules(raw.rules, modality),
    status: sanitizeStatus(raw.status),
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt
        ? raw.createdAt
        : new Date().toISOString(),
    closedAt: typeof raw.closedAt === 'string' ? raw.closedAt : undefined,
    birds,
    stages,
    entries,
    stageReminder: sanitizeStageReminder(raw.stageReminder),
    eventLogoDataUrl: resolveLoadedEventLogo(raw.eventLogoDataUrl),
  };
}

function migrateLegacyV2ToChampionship(
  legacy: ChampionshipState,
  options?: { forceInitialName?: boolean; idOverride?: string }
): Championship {
  const parsedYear = Math.floor(Number(legacy.seasonYear));
  const seasonYear =
    Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : 2026;
  const stages = Array.isArray(legacy.stages) ? legacy.stages : [];
  const birds = Array.isArray(legacy.birds) ? legacy.birds : [];
  const entries = Array.isArray(legacy.entries) ? sanitizeEntries(legacy.entries) : [];

  const resolvedName = options?.forceInitialName
    ? INITIAL_CHAMPIONSHIP_NAME
    : typeof legacy.championshipName === 'string' && legacy.championshipName.trim()
      ? legacy.championshipName.trim()
      : INITIAL_CHAMPIONSHIP_NAME;

  return {
    id: options?.idOverride ?? INITIAL_CHAMPIONSHIP_ID,
    name: resolvedName,
    modality: 'Coleiro',
    seasonYear,
    plannedStages: Math.max(26, stages.length),
    rules: getDefaultModalityRules('Coleiro'),
    status: 'Em andamento',
    createdAt: new Date().toISOString(),
    birds,
    stages,
    entries,
    stageReminder: sanitizeStageReminder(legacy.stageReminder),
    eventLogoDataUrl: resolveLoadedEventLogo(legacy.eventLogoDataUrl),
  };
}

function applyAttachmentSync(championships: Championship[]): Championship[] {
  const fresh = createInitialSampleChampionshipRecord();
  const hasInitial = championships.some((c) => c.id === INITIAL_CHAMPIONSHIP_ID);
  const targetId = hasInitial ? INITIAL_CHAMPIONSHIP_ID : championships[0]?.id;

  return championships.map((c) => {
    if (c.id !== targetId) return c;
    return {
      ...c,
      name: fresh.name,
      seasonYear: fresh.seasonYear,
      plannedStages: Math.max(c.plannedStages, fresh.plannedStages),
      birds: fresh.birds,
      stages: fresh.stages,
      entries: fresh.entries,
      stageReminder: fresh.stageReminder,
      eventLogoDataUrl: fresh.eventLogoDataUrl,
    };
  });
}

function markAttachmentSynced() {
  try {
    localStorage.setItem(ATTACHMENT_SYNC_KEY, '1');
  } catch {
    // Ignore storage quota errors
  }
}

function isAttachmentSynced(): boolean {
  try {
    return localStorage.getItem(ATTACHMENT_SYNC_KEY) === '1';
  } catch {
    return false;
  }
}

function loadInitialMultiState(): MultiChampionshipState {
  const alreadySynced = isAttachmentSynced();

  try {
    const rawV3 = localStorage.getItem(STORAGE_KEY_V3);
    if (rawV3) {
      const parsed = JSON.parse(rawV3) as Partial<MultiChampionshipState>;
      if (
        parsed &&
        Array.isArray(parsed.championships) &&
        parsed.championships.length > 0
      ) {
        let championships = parsed.championships.map((c) => sanitizeChampionship(c));
        if (!alreadySynced) {
          championships = applyAttachmentSync(championships);
          markAttachmentSynced();
        }
        const activeValid = championships.some(
          (c) => c.id === parsed.activeChampionshipId
        );
        const firstActive = championships.find((c) => c.status === 'Em andamento');
        return {
          version: 3,
          activeChampionshipId: activeValid
            ? parsed.activeChampionshipId!
            : (firstActive?.id ?? championships[0].id),
          championships,
        };
      }
    }
  } catch {
    // Fallback to v2 migration if v3 storage is corrupted
  }

  try {
    const rawV2 = localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    if (rawV2 && alreadySynced) {
      const parsedV2 = JSON.parse(rawV2) as ChampionshipState;
      if (
        parsedV2 &&
        Array.isArray(parsedV2.birds) &&
        Array.isArray(parsedV2.stages) &&
        Array.isArray(parsedV2.entries)
      ) {
        const migrated = migrateLegacyV2ToChampionship(parsedV2, {
          forceInitialName: true,
          idOverride: INITIAL_CHAMPIONSHIP_ID,
        });
        return {
          version: 3,
          activeChampionshipId: migrated.id,
          championships: [migrated],
        };
      }
    }
  } catch {
    // Fallback to sample championship if v2 is corrupted
  }

  const initial = createInitialSampleChampionshipRecord();
  markAttachmentSynced();
  return {
    version: 3,
    activeChampionshipId: initial.id,
    championships: [initial],
  };
}

export function useChampionshipStore() {
  const [multiState, setMultiState] = useState<MultiChampionshipState>(
    loadInitialMultiState
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(multiState));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [multiState]);

  const activeChampionship = useMemo(() => {
    const found = multiState.championships.find(
      (c) => c.id === multiState.activeChampionshipId
    );
    if (found) return found;
    return (
      multiState.championships.find((c) => c.status === 'Em andamento') ??
      multiState.championships[0]
    );
  }, [multiState]);

  const activeChampionships = useMemo(
    () => multiState.championships.filter((c) => c.status === 'Em andamento'),
    [multiState.championships]
  );

  const closedChampionships = useMemo(
    () =>
      multiState.championships
        .filter((c) => c.status === 'Encerrado')
        .sort((a, b) => {
          if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
          return (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt);
        }),
    [multiState.championships]
  );

  // Backward-compatible ChampionshipState projection for the active championship
  const state: ChampionshipState = useMemo(
    () => ({
      seasonYear: activeChampionship.seasonYear,
      championshipName: activeChampionship.name,
      birds: activeChampionship.birds,
      stages: activeChampionship.stages,
      entries: activeChampionship.entries,
      stageReminder: activeChampionship.stageReminder,
      eventLogoDataUrl: activeChampionship.eventLogoDataUrl,
    }),
    [activeChampionship]
  );

  const updateActiveChampionship = useCallback(
    (updater: (champ: Championship) => Championship, allowWhenClosed = false) => {
      setMultiState((prev) => {
        const targetId = prev.activeChampionshipId;
        return {
          ...prev,
          championships: prev.championships.map((c) => {
            if (c.id !== targetId) return c;
            if (!allowWhenClosed && c.status === 'Encerrado') return c;
            return updater(c);
          }),
        };
      });
    },
    []
  );

  const selectChampionship = useCallback((championshipId: string) => {
    setMultiState((prev) => {
      if (!prev.championships.some((c) => c.id === championshipId)) return prev;
      return {
        ...prev,
        activeChampionshipId: championshipId,
      };
    });
  }, []);

  const createChampionship = useCallback(
    (input: {
      name: string;
      modality: BirdModality;
      seasonYear: number;
      plannedStages: number;
      rules: ModalityRules;
    }): { ok: boolean; error?: string; championship?: Championship } => {
      const trimmedName = input.name.trim();
      const parsedYear = Math.floor(Number(input.seasonYear));
      const parsedPlanned = Math.floor(Number(input.plannedStages));

      if (!trimmedName) {
        return { ok: false, error: 'Informe o nome do campeonato.' };
      }
      if (!Number.isFinite(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return { ok: false, error: 'Informe um ano válido entre 2000 e 2100.' };
      }
      if (!Number.isFinite(parsedPlanned) || parsedPlanned < 1 || parsedPlanned > 60) {
        return {
          ok: false,
          error: 'Informe o total de etapas previstas entre 1 e 60.',
        };
      }

      const newChamp: Championship = {
        id: generateId('champ'),
        name: trimmedName,
        modality: sanitizeModality(input.modality),
        seasonYear: parsedYear,
        plannedStages: parsedPlanned,
        rules: sanitizeRules(input.rules, input.modality),
        status: 'Em andamento',
        createdAt: new Date().toISOString(),
        birds: [],
        stages: [],
        entries: [],
        stageReminder: {
          enabled: false,
          daysBefore: 3,
          browserNotification: false,
        },
        eventLogoDataUrl: cantoFibraLogo,
      };

      setMultiState((prev) => ({
        ...prev,
        activeChampionshipId: newChamp.id,
        championships: [...prev.championships, newChamp],
      }));

      return { ok: true, championship: newChamp };
    },
    []
  );

  const closeChampionship = useCallback(
    (championshipId: string): { ok: boolean; error?: string } => {
      const target = multiState.championships.find((c) => c.id === championshipId);
      if (!target) {
        return { ok: false, error: 'Campeonato não encontrado.' };
      }
      if (target.status === 'Encerrado') {
        return { ok: false, error: 'Este campeonato já está encerrado.' };
      }

      setMultiState((prev) => {
        const now = new Date().toISOString();
        const updatedChampionships = prev.championships.map((c) =>
          c.id === championshipId
            ? {
                ...c,
                status: 'Encerrado' as const,
                closedAt: now,
              }
            : c
        );
        const nextActive =
          prev.activeChampionshipId === championshipId
            ? (updatedChampionships.find((c) => c.status === 'Em andamento')?.id ??
              championshipId)
            : prev.activeChampionshipId;

        return {
          ...prev,
          activeChampionshipId: nextActive,
          championships: updatedChampionships,
        };
      });

      return { ok: true };
    },
    [multiState.championships]
  );

  const updateChampionshipSettings = useCallback(
    (input: {
      championshipName: string;
      seasonYear: number;
      modality?: BirdModality;
      plannedStages?: number;
      rules?: ModalityRules;
    }): {
      ok: boolean;
      error?: string;
    } => {
      if (activeChampionship.status === 'Encerrado') {
        return {
          ok: false,
          error: 'Campeonato encerrado. Edições estão bloqueadas.',
        };
      }
      const trimmedName = input.championshipName.trim();
      const parsedYear = Math.floor(Number(input.seasonYear));
      if (!trimmedName) {
        return { ok: false, error: 'Informe o nome do campeonato.' };
      }
      if (!Number.isFinite(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return { ok: false, error: 'Informe um ano válido entre 2000 e 2100.' };
      }

      const nextModality = input.modality
        ? sanitizeModality(input.modality)
        : activeChampionship.modality;
      const parsedPlanned =
        input.plannedStages !== undefined
          ? Math.floor(Number(input.plannedStages))
          : activeChampionship.plannedStages;

      if (!Number.isFinite(parsedPlanned) || parsedPlanned < 1 || parsedPlanned > 60) {
        return {
          ok: false,
          error: 'O total de etapas previstas deve estar entre 1 e 60.',
        };
      }
      if (parsedPlanned < activeChampionship.stages.length) {
        return {
          ok: false,
          error: `Já existem ${activeChampionship.stages.length} etapas cadastradas. O total previsto não pode ser menor que isso.`,
        };
      }

      updateActiveChampionship((champ) => ({
        ...champ,
        name: trimmedName,
        seasonYear: parsedYear,
        modality: nextModality,
        plannedStages: parsedPlanned,
        rules: input.rules ? sanitizeRules(input.rules, nextModality) : champ.rules,
      }));
      return { ok: true };
    },
    [activeChampionship, updateActiveChampionship]
  );

  const updateStageReminder = useCallback(
    (input: StageReminderConfig) => {
      if (activeChampionship.status === 'Encerrado') return;
      const days = Math.floor(Number(input.daysBefore));
      const clampedDays =
        Number.isFinite(days) && days >= 0 && days <= 60 ? days : 3;
      updateActiveChampionship((champ) => ({
        ...champ,
        stageReminder: {
          enabled: Boolean(input.enabled),
          daysBefore: clampedDays,
          browserNotification: Boolean(input.browserNotification),
        },
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const updateEventLogo = useCallback(
    (logoDataUrl: string | undefined) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => ({
        ...champ,
        eventLogoDataUrl:
          logoDataUrl === undefined ? '' : (sanitizeEventLogo(logoDataUrl) ?? ''),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  // --- BIRDS CRUD (sem número da anilha) ---
  const addBird = useCallback(
    (input: { name: string; ownerName: string; isMember: boolean }): {
      ok: boolean;
      error?: string;
      bird?: Bird;
    } => {
      if (activeChampionship.status === 'Encerrado') {
        return {
          ok: false,
          error: 'Campeonato encerrado. Não é possível cadastrar aves.',
        };
      }
      if (!input.name.trim() || !input.ownerName.trim()) {
        return { ok: false, error: 'Informe o nome da ave e o proprietário.' };
      }

      const newBird: Bird = {
        id: generateId('bird'),
        name: input.name.trim(),
        ownerName: input.ownerName.trim(),
        isMember: input.isMember,
        createdAt: new Date().toISOString(),
      };

      updateActiveChampionship((champ) => ({
        ...champ,
        birds: [...champ.birds, newBird],
      }));
      return { ok: true, bird: newBird };
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const updateBird = useCallback(
    (
      id: string,
      input: { name: string; ownerName: string; isMember: boolean }
    ): { ok: boolean; error?: string } => {
      if (activeChampionship.status === 'Encerrado') {
        return {
          ok: false,
          error: 'Campeonato encerrado. Edições estão bloqueadas.',
        };
      }
      if (!input.name.trim() || !input.ownerName.trim()) {
        return { ok: false, error: 'Informe o nome da ave e o proprietário.' };
      }

      updateActiveChampionship((champ) => ({
        ...champ,
        birds: champ.birds.map((b) =>
          b.id === id
            ? {
                ...b,
                name: input.name.trim(),
                ownerName: input.ownerName.trim(),
                isMember: input.isMember,
              }
            : b
        ),
      }));
      return { ok: true };
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const deleteBird = useCallback(
    (id: string) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => ({
        ...champ,
        birds: champ.birds.filter((b) => b.id !== id),
        entries: champ.entries.filter((e) => e.birdId !== id),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  // --- STAGES CRUD ---
  const addStage = useCallback(
    (input: { stageNumber: number; name: string; date: string; address: string }): {
      ok: boolean;
      error?: string;
      stage?: Stage;
    } => {
      if (activeChampionship.status === 'Encerrado') {
        return {
          ok: false,
          error: 'Campeonato encerrado. Não é possível adicionar etapas.',
        };
      }
      if (activeChampionship.stages.length >= activeChampionship.plannedStages) {
        return {
          ok: false,
          error: `Limite máximo de ${activeChampionship.plannedStages} etapas previstas atingido.`,
        };
      }

      const duplicateNum = activeChampionship.stages.find(
        (s) => s.stageNumber === input.stageNumber
      );
      if (duplicateNum) {
        return {
          ok: false,
          error: `Já existe uma etapa com o número ${input.stageNumber}.`,
        };
      }

      const newStage: Stage = {
        id: generateId('stage'),
        stageNumber: input.stageNumber,
        name: input.name.trim(),
        date: input.date,
        address: input.address.trim(),
        tiebreakMode: 'manual',
        createdAt: new Date().toISOString(),
      };

      updateActiveChampionship((champ) => ({
        ...champ,
        stages: [...champ.stages, newStage].sort(
          (a, b) => a.stageNumber - b.stageNumber
        ),
      }));
      return { ok: true, stage: newStage };
    },
    [activeChampionship, updateActiveChampionship]
  );

  const updateStage = useCallback(
    (
      id: string,
      input: { stageNumber: number; name: string; date: string; address: string }
    ): { ok: boolean; error?: string } => {
      if (activeChampionship.status === 'Encerrado') {
        return {
          ok: false,
          error: 'Campeonato encerrado. Edições nas etapas estão bloqueadas.',
        };
      }
      const duplicateNum = activeChampionship.stages.find(
        (s) => s.id !== id && s.stageNumber === input.stageNumber
      );
      if (duplicateNum) {
        return {
          ok: false,
          error: `Já existe outra etapa com o número ${input.stageNumber}.`,
        };
      }

      updateActiveChampionship((champ) => ({
        ...champ,
        stages: champ.stages
          .map((s) =>
            s.id === id
              ? {
                  ...s,
                  stageNumber: input.stageNumber,
                  name: input.name.trim(),
                  date: input.date,
                  address: input.address.trim(),
                }
              : s
          )
          .sort((a, b) => a.stageNumber - b.stageNumber),
      }));
      return { ok: true };
    },
    [activeChampionship, updateActiveChampionship]
  );

  const deleteStage = useCallback(
    (id: string) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => ({
        ...champ,
        stages: champ.stages.filter((s) => s.id !== id),
        entries: champ.entries.filter((e) => e.stageId !== id),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const setStageTiebreakMode = useCallback(
    (stageId: string, mode: TiebreakMode) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => ({
        ...champ,
        stages: champ.stages.map((s) =>
          s.id === stageId ? { ...s, tiebreakMode: mode } : s
        ),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const sortStageEntriesByStake = (entries: StageEntry[], stageId: string): StageEntry[] => {
    const otherEntries: StageEntry[] = [];
    const targetEntries: StageEntry[] = [];
    for (const entry of entries) {
      if (entry.stageId === stageId) {
        targetEntries.push(entry);
      } else {
        otherEntries.push(entry);
      }
    }
    targetEntries.sort((a, b) => compareStakeNumbers(a.stakeNumber, b.stakeNumber));
    return [...otherEntries, ...targetEntries];
  };

  // --- STAGE ENTRIES, STAKES (ESTACAS) & SCORING ---
  const enrollBirdInStage = useCallback(
    (stageId: string, birdId: string, stakeNumber = '') => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => {
        const exists = champ.entries.some(
          (e) => e.stageId === stageId && e.birdId === birdId
        );
        if (exists) return champ;
        const stageEntries = champ.entries.filter((e) => e.stageId === stageId);
        const resolvedStake = stakeNumber.trim()
          ? stakeNumber.trim().toUpperCase()
          : getNextAvailableStakeNumber(stageEntries);
        const newEntry: StageEntry = {
          id: generateId('entry'),
          stageId,
          birdId,
          stakeNumber: resolvedStake,
          part1Songs: 0,
          part2Songs: 0,
          manualTiebreakOrder: stageEntries.length + 1,
          updatedAt: new Date().toISOString(),
        };
        return {
          ...champ,
          entries: sortStageEntriesByStake([...champ.entries, newEntry], stageId),
        };
      });
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const enrollMultipleBirdsInStage = useCallback(
    (stageId: string, birdIds: string[]) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => {
        const stageEntries = champ.entries.filter((e) => e.stageId === stageId);
        const existingSet = new Set(stageEntries.map((e) => e.birdId));
        let nextOrder = existingSet.size + 1;
        const now = new Date().toISOString();
        const virtualStageEntries = [...stageEntries];
        const added: StageEntry[] = [];
        for (const birdId of birdIds) {
          if (!existingSet.has(birdId)) {
            const autoStake = getNextAvailableStakeNumber(virtualStageEntries);
            const created: StageEntry = {
              id: generateId('entry'),
              stageId,
              birdId,
              stakeNumber: autoStake,
              part1Songs: 0,
              part2Songs: 0,
              manualTiebreakOrder: nextOrder++,
              updatedAt: now,
            };
            added.push(created);
            virtualStageEntries.push(created);
          }
        }
        if (added.length === 0) return champ;
        return {
          ...champ,
          entries: sortStageEntriesByStake([...champ.entries, ...added], stageId),
        };
      });
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const removeBirdFromStage = useCallback(
    (stageId: string, birdId: string) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => ({
        ...champ,
        entries: champ.entries.filter(
          (e) => !(e.stageId === stageId && e.birdId === birdId)
        ),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const updateEntryStakeNumber = useCallback(
    (entryId: string, stakeNumber: string) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => {
        let affectedStageId: string | null = null;
        const updated = champ.entries.map((e) => {
          if (e.id !== entryId) return e;
          affectedStageId = e.stageId;
          return {
            ...e,
            stakeNumber: stakeNumber.trim().toUpperCase(),
            updatedAt: new Date().toISOString(),
          };
        });
        return {
          ...champ,
          entries: affectedStageId
            ? sortStageEntriesByStake(updated, affectedStageId)
            : updated,
        };
      });
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const updateEntrySongs = useCallback(
    (entryId: string, field: 'part1Songs' | 'part2Songs', value: number) => {
      if (activeChampionship.status === 'Encerrado') return;
      const sanitized = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
      updateActiveChampionship((champ) => ({
        ...champ,
        entries: champ.entries.map((e) =>
          e.id === entryId
            ? { ...e, [field]: sanitized, updatedAt: new Date().toISOString() }
            : e
        ),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const incrementEntrySong = useCallback(
    (entryId: string, field: 'part1Songs' | 'part2Songs', delta: number) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => ({
        ...champ,
        entries: champ.entries.map((e) =>
          e.id === entryId
            ? {
                ...e,
                [field]: Math.max(0, e[field] + delta),
                updatedAt: new Date().toISOString(),
              }
            : e
        ),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const updateManualTiebreakOrder = useCallback(
    (entryId: string, order: number) => {
      if (activeChampionship.status === 'Encerrado') return;
      const sanitized = Math.max(1, Math.floor(Number.isFinite(order) ? order : 1));
      updateActiveChampionship((champ) => ({
        ...champ,
        entries: champ.entries.map((e) =>
          e.id === entryId
            ? { ...e, manualTiebreakOrder: sanitized, updatedAt: new Date().toISOString() }
            : e
        ),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const swapManualTiebreakOrder = useCallback(
    (entryIdA: string, entryIdB: string) => {
      if (activeChampionship.status === 'Encerrado') return;
      updateActiveChampionship((champ) => {
        const entryA = champ.entries.find((e) => e.id === entryIdA);
        const entryB = champ.entries.find((e) => e.id === entryIdB);
        if (!entryA || !entryB) return champ;
        let orderA = entryA.manualTiebreakOrder;
        let orderB = entryB.manualTiebreakOrder;
        if (orderA === orderB) {
          orderA = 1;
          orderB = 2;
        }
        return {
          ...champ,
          entries: champ.entries.map((e) => {
            if (e.id === entryIdA) return { ...e, manualTiebreakOrder: orderB };
            if (e.id === entryIdB) return { ...e, manualTiebreakOrder: orderA };
            return e;
          }),
        };
      });
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  const drawTieGroupRandomly = useCallback(
    (entryIds: string[]) => {
      if (activeChampionship.status === 'Encerrado') return;
      const shuffled = [...entryIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const orderMap = new Map<string, number>();
      shuffled.forEach((id, index) => orderMap.set(id, index + 1));

      updateActiveChampionship((champ) => ({
        ...champ,
        entries: champ.entries.map((e) =>
          orderMap.has(e.id)
            ? {
                ...e,
                manualTiebreakOrder: orderMap.get(e.id)!,
                updatedAt: new Date().toISOString(),
              }
            : e
        ),
      }));
    },
    [activeChampionship.status, updateActiveChampionship]
  );

  // --- SEASON BACKUP / RESET ---
  const resetToEmpty = useCallback(() => {
    if (activeChampionship.status === 'Encerrado') return;
    const empty = createEmptyChampionship();
    updateActiveChampionship((champ) => ({
      ...champ,
      birds: empty.birds,
      stages: empty.stages,
      entries: empty.entries,
    }));
  }, [activeChampionship.status, updateActiveChampionship]);

  const loadSampleData = useCallback(() => {
    if (activeChampionship.status === 'Encerrado') return;
    const sample = createSampleChampionship();
    updateActiveChampionship((champ) => ({
      ...champ,
      name: sample.championshipName,
      seasonYear: sample.seasonYear,
      plannedStages: Math.max(champ.plannedStages, sample.stages.length),
      birds: sample.birds,
      stages: sample.stages,
      entries: sample.entries,
      stageReminder: sample.stageReminder,
      eventLogoDataUrl: sample.eventLogoDataUrl,
    }));
  }, [activeChampionship.status, updateActiveChampionship]);

  const importStateJson = useCallback(
    (jsonText: string): { ok: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(jsonText) as
          | Partial<MultiChampionshipState>
          | Partial<ChampionshipState>;

        // Case 1: Multi-championship v3 backup
        if (
          parsed &&
          'championships' in parsed &&
          Array.isArray(parsed.championships) &&
          parsed.championships.length > 0
        ) {
          const championships = parsed.championships.map((c) => sanitizeChampionship(c));
          const activeValid = championships.some(
            (c) => c.id === parsed.activeChampionshipId
          );
          const firstActive = championships.find((c) => c.status === 'Em andamento');
          setMultiState({
            version: 3,
            activeChampionshipId: activeValid
              ? parsed.activeChampionshipId!
              : (firstActive?.id ?? championships[0].id),
            championships,
          });
          return { ok: true };
        }

        // Case 2: Legacy single-championship v2 backup -> migrate without losing existing championships
        if (
          parsed &&
          'birds' in parsed &&
          'stages' in parsed &&
          'entries' in parsed &&
          Array.isArray(parsed.birds) &&
          Array.isArray(parsed.stages) &&
          Array.isArray(parsed.entries)
        ) {
          const legacyChamp = migrateLegacyV2ToChampionship(
            parsed as ChampionshipState,
            {
              forceInitialName: false,
              idOverride: generateId('champ'),
            }
          );

          setMultiState((prev) => ({
            version: 3,
            activeChampionshipId: legacyChamp.id,
            championships: [...prev.championships, legacyChamp],
          }));
          return { ok: true };
        }

        return { ok: false, error: 'Arquivo JSON inválido para o campeonato.' };
      } catch {
        return { ok: false, error: 'Não foi possível ler o arquivo JSON selecionado.' };
      }
    },
    []
  );

  return {
    multiState,
    championships: multiState.championships,
    activeChampionship,
    activeChampionships,
    closedChampionships,
    state,
    selectChampionship,
    createChampionship,
    closeChampionship,
    updateChampionshipSettings,
    updateStageReminder,
    updateEventLogo,
    addBird,
    updateBird,
    deleteBird,
    addStage,
    updateStage,
    deleteStage,
    setStageTiebreakMode,
    enrollBirdInStage,
    enrollMultipleBirdsInStage,
    removeBirdFromStage,
    updateEntryStakeNumber,
    updateEntrySongs,
    incrementEntrySong,
    updateManualTiebreakOrder,
    swapManualTiebreakOrder,
    drawTieGroupRandomly,
    resetToEmpty,
    loadSampleData,
    importStateJson,
  };
}
