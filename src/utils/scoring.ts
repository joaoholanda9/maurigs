import type {
  Bird,
  BirdModality,
  BirdStageBreakdown,
  GeneralRankingRow,
  MemberFilter,
  ModalityRules,
  RankedStageEntry,
  Stage,
  StageEntry,
} from '../types/championship';

export const MAX_STAGES = 26;

export const MODALITY_DEFAULT_RULES: Record<BirdModality, ModalityRules> = {
  Coleiro: {
    part1Minutes: 10,
    part2Minutes: 15,
    scoringPositions: 30,
    minPart1ToScore: 1,
    rulesNotes:
      '1ª parte classificatória (10 min) e 2ª parte final (15 min). Pontuação do 1º ao 30º lugar (30 a 1 pt). Desempate no geral pelo total de cantos em todas as etapas.',
  },
  'Papa-Capim': {
    part1Minutes: 10,
    part2Minutes: 15,
    scoringPositions: 30,
    minPart1ToScore: 1,
    rulesNotes:
      '1ª parte classificatória (10 min) e 2ª parte final (15 min). Pontuação do 1º ao 30º lugar (30 a 1 pt). Desempate no geral pelo total de cantos em todas as etapas.',
  },
  'Trinca-Ferro': {
    part1Minutes: 10,
    part2Minutes: 15,
    scoringPositions: 30,
    minPart1ToScore: 1,
    rulesNotes:
      'Contagem em duas baterias (10 min e 15 min) com pontuação do 1º ao 30º colocado. Desempate no geral pelo total de cantos em todas as etapas.',
  },
  'Canário-da-Terra': {
    part1Minutes: 10,
    part2Minutes: 15,
    scoringPositions: 30,
    minPart1ToScore: 1,
    rulesNotes:
      'Contagem em duas baterias (10 min e 15 min) para fibra/canto livre. Desempate no geral pelo total de cantos em todas as etapas.',
  },
  Curió: {
    part1Minutes: 10,
    part2Minutes: 15,
    scoringPositions: 30,
    minPart1ToScore: 1,
    rulesNotes:
      'Avaliação oficial por tempo de canto (0:00.0 — minutos, segundos e décimos) em duas tomadas (10 min e 15 min). Pontuação do 1º ao 30º lugar. Desempate no geral pelo maior tempo total em todas as etapas.',
  },
  Bicudo: {
    part1Minutes: 10,
    part2Minutes: 15,
    scoringPositions: 30,
    minPart1ToScore: 1,
    rulesNotes:
      'Avaliação oficial por tempo de canto (0:00.0 — minutos, segundos e décimos) em duas tomadas (10 min e 15 min). Pontuação do 1º ao 30º lugar. Desempate no geral pelo maior tempo total em todas as etapas.',
  },
  Azulão: {
    part1Minutes: 10,
    part2Minutes: 15,
    scoringPositions: 30,
    minPart1ToScore: 1,
    rulesNotes:
      'Contagem em duas baterias (10 min e 15 min) com pontuação do 1º ao 30º colocado (30 a 1 pt). Desempate no geral pelo total de cantos em todas as etapas.',
  },
};

export function getDefaultModalityRules(modality: BirdModality): ModalityRules {
  return { ...MODALITY_DEFAULT_RULES[modality] };
}

export function getModalityTopLimit(modality?: BirdModality): number {
  if (modality === 'Canário-da-Terra') return 10;
  if (modality === 'Trinca-Ferro') return 20;
  return 30;
}

export function isTimeScoredModality(modality?: BirdModality): boolean {
  return modality === 'Bicudo' || modality === 'Curió';
}

export function formatTenthsAsTime(tenths: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(tenths) ? tenths : 0));
  const mins = Math.floor(safe / 600);
  const secs = Math.floor((safe % 600) / 10);
  const dec = safe % 10;
  return `${mins}:${String(secs).padStart(2, '0')}.${dec}`;
}

export function formatScoreValue(value: number, modality?: BirdModality): string {
  if (isTimeScoredModality(modality)) {
    return formatTenthsAsTime(value);
  }
  return String(value);
}

export function formatAverageScoreValue(avg: number, modality?: BirdModality): string {
  if (isTimeScoredModality(modality)) {
    return formatTenthsAsTime(Math.round(avg));
  }
  const safe = Number.isFinite(avg) ? avg : 0;
  return safe.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function parseTimeTenths(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '.');
  if (!cleaned) return 0;

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    if (parts.length > 2) return null;
    const minPart = parts[0].trim();
    const secPart = parts[1].trim();
    const mins = minPart === '' ? 0 : Number.parseInt(minPart, 10);
    if (!Number.isFinite(mins) || mins < 0 || !/^\d*$/.test(minPart)) return null;

    if (secPart === '') return mins * 600;
    const secSegments = secPart.split('.');
    if (secSegments.length > 2) return null;
    if (!/^\d*$/.test(secSegments[0]) || (secSegments[1] !== undefined && !/^\d*$/.test(secSegments[1]))) {
      return null;
    }
    const secs = secSegments[0] === '' ? 0 : Number.parseInt(secSegments[0], 10);
    if (!Number.isFinite(secs) || secs < 0) return null;
    let dec = 0;
    if (secSegments.length === 2 && secSegments[1] !== '') {
      const parsedDec = Number.parseInt(secSegments[1][0], 10);
      if (!Number.isFinite(parsedDec) || parsedDec < 0) return null;
      dec = parsedDec;
    }
    return mins * 600 + secs * 10 + dec;
  }

  const segments = cleaned.split('.');
  if (segments.length > 2) return null;
  if (!/^\d*$/.test(segments[0]) || (segments[1] !== undefined && !/^\d*$/.test(segments[1]))) {
    return null;
  }
  const secs = segments[0] === '' ? 0 : Number.parseInt(segments[0], 10);
  if (!Number.isFinite(secs) || secs < 0) return null;
  let dec = 0;
  if (segments.length === 2 && segments[1] !== '') {
    const parsedDec = Number.parseInt(segments[1][0], 10);
    if (!Number.isFinite(parsedDec) || parsedDec < 0) return null;
    dec = parsedDec;
  }
  return secs * 10 + dec;
}

export function calculateStagePoints(position: number, scoringPositions = 30): number {
  const maxPos = Math.max(1, Math.floor(scoringPositions));
  if (position < 1 || position > maxPos) return 0;
  return maxPos + 1 - position;
}

export function countConcludedStages(
  stages: Stage[],
  entries: StageEntry[],
  minPart1ToScore = 1
): number {
  const activeStageIds = new Set(
    entries
      .filter((e) => e.part1Songs >= minPart1ToScore)
      .map((e) => e.stageId)
  );
  return stages.filter((s) => activeStageIds.has(s.id)).length;
}

export function calculateApprovalPercent(
  points: number,
  stageCount: number,
  scoringPositions = 30
): number {
  if (!Number.isFinite(points) || !Number.isFinite(stageCount) || stageCount <= 0) {
    return 0;
  }
  const maxPoints = stageCount * Math.max(1, Math.floor(scoringPositions));
  return (points / maxPoints) * 100;
}

export function formatPercentPtBr(percent: number): string {
  const safe = Number.isFinite(percent) ? percent : 0;
  return `${safe.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatDatePtBr(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

export function filterByMemberStatus<T extends { bird: Bird }>(
  items: T[],
  filter: MemberFilter
): T[] {
  if (filter === 'members') return items.filter((i) => i.bird.isMember);
  if (filter === 'non_members') return items.filter((i) => !i.bird.isMember);
  return items;
}

export function normalizeBirdName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function findBirdsWithSameName(
  birds: Bird[],
  candidateName: string,
  excludeBirdId?: string
): Bird[] {
  const key = normalizeBirdName(candidateName);
  if (!key) return [];
  return birds.filter(
    (b) => b.id !== excludeBirdId && normalizeBirdName(b.name) === key
  );
}

export function getDuplicateBirdNameKeys(birds: Bird[]): Set<string> {
  const counts = new Map<string, number>();
  for (const bird of birds) {
    const key = normalizeBirdName(bird.name);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [key, count] of counts.entries()) {
    if (count > 1) duplicates.add(key);
  }
  return duplicates;
}

export function parseStakeNumeric(stakeNumber: string): number | null {
  const trimmed = stakeNumber.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function compareStakeNumbers(stakeA: string, stakeB: string): number {
  const numA = parseStakeNumeric(stakeA);
  const numB = parseStakeNumeric(stakeB);

  if (numA !== null && numB !== null) {
    if (numA !== numB) return numA - numB;
    return stakeA.trim().localeCompare(stakeB.trim(), 'pt-BR', { numeric: true });
  }
  if (numA !== null) return -1;
  if (numB !== null) return 1;

  const trimA = stakeA.trim();
  const trimB = stakeB.trim();
  if (trimA && !trimB) return -1;
  if (!trimA && trimB) return 1;
  if (trimA && trimB) {
    return trimA.localeCompare(trimB, 'pt-BR', { numeric: true });
  }
  return 0;
}

export function getNextAvailableStakeNumber(
  stageEntries: Pick<StageEntry, 'stakeNumber'>[]
): string {
  let maxNumeric = 0;
  for (const entry of stageEntries) {
    const num = parseStakeNumeric(entry.stakeNumber);
    if (num !== null && num > maxNumeric) {
      maxNumeric = num;
    }
  }
  const next = Math.max(stageEntries.length, maxNumeric) + 1;
  return String(next).padStart(2, '0');
}

export function computeStageRanking(
  stage: Stage,
  entries: StageEntry[],
  birds: Bird[],
  options?: { scoringPositions?: number; minPart1ToScore?: number }
): RankedStageEntry[] {
  const scoringPositions = options?.scoringPositions ?? 30;
  const minPart1ToScore = options?.minPart1ToScore ?? 1;
  const birdMap = new Map<string, Bird>(birds.map((b) => [b.id, b]));
  const stageEntries = entries.filter((e) => e.stageId === stage.id && birdMap.has(e.birdId));

  const entryIndexMap = new Map<string, number>(
    stageEntries.map((e, idx) => [e.id, idx])
  );

  // Count tie groups based on exact (part2Songs, part1Songs) for scored entries
  const groupCounts = new Map<string, number>();
  for (const e of stageEntries) {
    if (e.part1Songs < minPart1ToScore) continue;
    const key = `${e.part2Songs}-${e.part1Songs}`;
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  }

  const sorted = [...stageEntries].sort((a, b) => {
    const aQualified = a.part1Songs >= minPart1ToScore;
    const bQualified = b.part1Songs >= minPart1ToScore;
    if (aQualified !== bQualified) {
      return bQualified ? 1 : -1;
    }

    if (!aQualified && !bQualified) {
      const stakeCmp = compareStakeNumbers(a.stakeNumber, b.stakeNumber);
      if (stakeCmp !== 0) return stakeCmp;
      if (b.part2Songs !== a.part2Songs) {
        return b.part2Songs - a.part2Songs;
      }
      return (entryIndexMap.get(a.id) ?? 0) - (entryIndexMap.get(b.id) ?? 0);
    }

    // Critério Principal: 2ª Parte - maior para o menor
    if (b.part2Songs !== a.part2Songs) {
      return b.part2Songs - a.part2Songs;
    }
    // 1º Critério de Desempate: 1ª Parte - maior para o menor
    if (b.part1Songs !== a.part1Songs) {
      return b.part1Songs - a.part1Songs;
    }
    // 2º Critério / Ordem de registro: manualTiebreakOrder -> ordem de inscrição
    if (a.manualTiebreakOrder !== b.manualTiebreakOrder) {
      return a.manualTiebreakOrder - b.manualTiebreakOrder;
    }
    return (entryIndexMap.get(a.id) ?? 0) - (entryIndexMap.get(b.id) ?? 0);
  });

  const ranked: RankedStageEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const bird = birdMap.get(entry.birdId)!;
    const isScored = entry.part1Songs >= minPart1ToScore;
    const tieGroupKey = `${entry.part2Songs}-${entry.part1Songs}`;
    const tieGroupSize = isScored ? (groupCounts.get(tieGroupKey) ?? 1) : 1;
    const isTied = isScored && tieGroupSize > 1;

    let position = i + 1;
    if (stage.tiebreakMode === 'shared' && isScored && i > 0) {
      const prev = ranked[i - 1];
      if (
        prev.entry.part2Songs === entry.part2Songs &&
        prev.entry.part1Songs === entry.part1Songs
      ) {
        position = prev.position;
      }
    }

    const points = isScored ? calculateStagePoints(position, scoringPositions) : 0;

    ranked.push({
      entry,
      bird,
      position,
      points,
      isTied,
      tieGroupKey,
      tieGroupSize,
    });
  }

  return ranked;
}

export function computeGeneralRanking(
  stages: Stage[],
  entries: StageEntry[],
  birds: Bird[],
  options?: { scoringPositions?: number; minPart1ToScore?: number }
): GeneralRankingRow[] {
  const minPart1ToScore = options?.minPart1ToScore ?? 1;
  const stageBreakdownsByBird = new Map<string, BirdStageBreakdown[]>();
  for (const bird of birds) {
    stageBreakdownsByBird.set(bird.id, []);
  }

  const orderedStages = [...stages].sort((a, b) => a.stageNumber - b.stageNumber);

  for (const stage of orderedStages) {
    const ranked = computeStageRanking(stage, entries, birds, options);
    for (const item of ranked) {
      if (item.entry.part1Songs < minPart1ToScore) continue;
      const list = stageBreakdownsByBird.get(item.bird.id);
      if (list) {
        list.push({
          stageId: stage.id,
          stageNumber: stage.stageNumber,
          stageName: stage.name,
          date: stage.date,
          position: item.position,
          points: item.points,
          part1Songs: item.entry.part1Songs,
          part2Songs: item.entry.part2Songs,
        });
      }
    }
  }

  const rows: Omit<GeneralRankingRow, 'position'>[] = birds.map((bird) => {
    const breakdowns = stageBreakdownsByBird.get(bird.id) ?? [];
    const totalPoints = breakdowns.reduce((acc, b) => acc + b.points, 0);
    const totalPart1Songs = breakdowns.reduce((acc, b) => acc + b.part1Songs, 0);
    const totalPart2Songs = breakdowns.reduce((acc, b) => acc + b.part2Songs, 0);
    const totalSongs = totalPart1Songs + totalPart2Songs;

    return {
      bird,
      totalPoints,
      stagesDisputed: breakdowns.length,
      totalPart1Songs,
      totalPart2Songs,
      totalSongs,
      stageBreakdowns: breakdowns,
    };
  });

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    // Critério de desempate em igualdade de pontos: número total de cantos em todas as etapas
    if (b.totalSongs !== a.totalSongs) return b.totalSongs - a.totalSongs;
    if (b.totalPart2Songs !== a.totalPart2Songs) return b.totalPart2Songs - a.totalPart2Songs;
    if (b.totalPart1Songs !== a.totalPart1Songs) return b.totalPart1Songs - a.totalPart1Songs;
    if (b.stagesDisputed !== a.stagesDisputed) return b.stagesDisputed - a.stagesDisputed;
    return a.bird.name.localeCompare(b.bird.name, 'pt-BR');
  });

  return rows.map((row, idx) => ({
    ...row,
    position: idx + 1,
  }));
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  metadataRows?: (string | number)[][]
): void {
  const bom = '\uFEFF';
  const lines: string[] = [];
  if (metadataRows && metadataRows.length > 0) {
    for (const meta of metadataRows) {
      lines.push(meta.map(escapeCsvCell).join(','));
    }
    lines.push('');
  }
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const r of rows) {
    lines.push(r.map(escapeCsvCell).join(','));
  }
  const csvContent = bom + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
