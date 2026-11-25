import cantoFibraLogo from '../assets/aope-logo.svg';
import type {
  Bird,
  Championship,
  ChampionshipState,
  Stage,
  StageEntry,
  StageReminderConfig,
  TiebreakMode,
} from '../types/championship';
import { getDefaultModalityRules } from '../utils/scoring';
import rawAopeSeed from './aope2026Seed.json';

export const INITIAL_CHAMPIONSHIP_ID = 'champ-2026-coleiro';
export const INITIAL_CHAMPIONSHIP_NAME =
  typeof rawAopeSeed.championshipName === 'string' && rawAopeSeed.championshipName.trim()
    ? rawAopeSeed.championshipName.trim()
    : 'Campeonato Pernambucano de Coleiro e Papa Capim AOPE';

export function createEmptyChampionship(): ChampionshipState {
  return {
    seasonYear: 2026,
    championshipName: INITIAL_CHAMPIONSHIP_NAME,
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
}

function cloneBird(b: typeof rawAopeSeed.birds[number]): Bird {
  return {
    id: String(b.id),
    name: String(b.name),
    ownerName: String(b.ownerName),
    isMember: Boolean(b.isMember),
    createdAt: String(b.createdAt),
  };
}

function cloneStage(s: typeof rawAopeSeed.stages[number]): Stage {
  const tiebreakMode: TiebreakMode =
    s.tiebreakMode === 'shared' ? 'shared' : 'manual';
  return {
    id: String(s.id),
    stageNumber: Number(s.stageNumber),
    name: String(s.name),
    date: String(s.date),
    address: String(s.address),
    tiebreakMode,
    createdAt: String(s.createdAt),
  };
}

function cloneEntry(e: typeof rawAopeSeed.entries[number]): StageEntry {
  return {
    id: String(e.id),
    stageId: String(e.stageId),
    birdId: String(e.birdId),
    stakeNumber: typeof e.stakeNumber === 'string' ? e.stakeNumber : '',
    part1Songs: Number(e.part1Songs) || 0,
    part2Songs: Number(e.part2Songs) || 0,
    manualTiebreakOrder: Number(e.manualTiebreakOrder) || 1,
    updatedAt: String(e.updatedAt),
  };
}

function cloneReminder(
  r: typeof rawAopeSeed.stageReminder | undefined
): StageReminderConfig {
  return {
    enabled: Boolean(r?.enabled),
    daysBefore:
      typeof r?.daysBefore === 'number' && Number.isFinite(r.daysBefore)
        ? Math.max(0, Math.floor(r.daysBefore))
        : 0,
    browserNotification: Boolean(r?.browserNotification),
  };
}

export function createSampleChampionship(): ChampionshipState {
  return {
    seasonYear: Number(rawAopeSeed.seasonYear) || 2026,
    championshipName: INITIAL_CHAMPIONSHIP_NAME,
    birds: rawAopeSeed.birds.map(cloneBird),
    stages: rawAopeSeed.stages.map(cloneStage),
    entries: rawAopeSeed.entries.map(cloneEntry),
    stageReminder: cloneReminder(rawAopeSeed.stageReminder),
    eventLogoDataUrl:
      typeof rawAopeSeed.eventLogoDataUrl === 'string' &&
      rawAopeSeed.eventLogoDataUrl.trim()
        ? rawAopeSeed.eventLogoDataUrl
        : cantoFibraLogo,
  };
}

export function createInitialSampleChampionshipRecord(): Championship {
  const sample = createSampleChampionship();
  return {
    id: INITIAL_CHAMPIONSHIP_ID,
    name: sample.championshipName,
    modality: 'Coleiro',
    seasonYear: sample.seasonYear,
    plannedStages: Math.max(26, sample.stages.length),
    rules: getDefaultModalityRules('Coleiro'),
    status: 'Em andamento',
    createdAt: '2026-01-01T00:00:00Z',
    birds: sample.birds,
    stages: sample.stages,
    entries: sample.entries,
    stageReminder: sample.stageReminder,
    eventLogoDataUrl: sample.eventLogoDataUrl,
  };
}
