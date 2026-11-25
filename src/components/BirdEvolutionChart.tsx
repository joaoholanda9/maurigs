import { TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  Bird,
  BirdModality,
  GeneralRankingRow,
  Stage,
  StageEntry,
} from '../types/championship';
import {
  computeStageRanking,
  formatDatePtBr,
  formatScoreValue,
  isTimeScoredModality,
} from '../utils/scoring';

interface BirdEvolutionChartProps {
  birds: Bird[];
  stages: Stage[];
  entries: StageEntry[];
  generalRanking: GeneralRankingRow[];
  modality?: BirdModality;
  part1Minutes?: number;
  part2Minutes?: number;
  scoringPositions?: number;
  minPart1ToScore?: number;
}

type ChartMetric = 'stage' | 'cumulative';

interface StagePointDatum {
  stageLabel: string;
  stageNumber: number;
  stageName: string;
  stageDate: string;
  participated: boolean;
  position: number | null;
  stagePoints: number;
  cumulativePoints: number;
  part1Songs: number;
  part2Songs: number;
}

function CustomChartTooltip({
  active,
  payload,
  metric,
  modality,
  part1Minutes = 10,
  part2Minutes = 15,
}: {
  active?: boolean;
  payload?: Array<{ payload: StagePointDatum }>;
  metric: ChartMetric;
  modality?: BirdModality;
  part1Minutes?: number;
  part2Minutes?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  const isTimeModality = isTimeScoredModality(modality);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md px-3 py-2 text-xs space-y-1 max-w-[240px]">
      <p className="font-display font-bold text-slate-900 leading-snug">
        Etapa {String(item.stageNumber).padStart(2, '0')} — {item.stageName}
      </p>
      <p className="text-[11px] font-mono tabular-nums text-slate-500">
        {formatDatePtBr(item.stageDate)}
      </p>
      <div className="pt-1 border-t border-slate-100 space-y-0.5">
        {item.participated ? (
          <>
            <p className="flex items-center justify-between gap-3">
              <span className="text-slate-600">Colocação:</span>
              <span className="font-mono tabular-nums font-bold text-slate-900">
                {item.position}º lugar
              </span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="text-slate-600">
                {isTimeModality ? 'Tempo' : 'Cantos'} ({part1Minutes}m / {part2Minutes}m):
              </span>
              <span className="font-mono tabular-nums font-semibold text-slate-800">
                {formatScoreValue(item.part1Songs, modality)} /{' '}
                {formatScoreValue(item.part2Songs, modality)}
              </span>
            </p>
          </>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            Não pontuou / não participou
          </p>
        )}
        <p className="flex items-center justify-between gap-3">
          <span className="text-slate-600">Pontos na etapa:</span>
          <span
            className={`font-mono tabular-nums font-bold ${
              metric === 'stage' ? 'text-emerald-800' : 'text-slate-900'
            }`}
          >
            {item.stagePoints} pts
          </span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-slate-600">Acumulado:</span>
          <span
            className={`font-mono tabular-nums font-bold ${
              metric === 'cumulative' ? 'text-emerald-800' : 'text-slate-900'
            }`}
          >
            {item.cumulativePoints} pts
          </span>
        </p>
      </div>
    </div>
  );
}

export function BirdEvolutionChart({
  birds,
  stages,
  entries,
  generalRanking,
  modality,
  part1Minutes = 10,
  part2Minutes = 15,
  scoringPositions = 30,
  minPart1ToScore = 1,
}: BirdEvolutionChartProps) {
  const [metric, setMetric] = useState<ChartMetric>('stage');

  const orderedBirds = useMemo(() => {
    const rankMap = new Map<string, GeneralRankingRow>();
    for (const row of generalRanking) {
      rankMap.set(row.bird.id, row);
    }
    return [...birds].sort((a, b) => {
      const ra = rankMap.get(a.id);
      const rb = rankMap.get(b.id);
      if (ra && rb) return ra.position - rb.position;
      if (ra) return -1;
      if (rb) return 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [birds, generalRanking]);

  const [selectedBirdId, setSelectedBirdId] = useState<string>(
    () => orderedBirds[0]?.id ?? ''
  );

  useEffect(() => {
    if (orderedBirds.length === 0) {
      if (selectedBirdId !== '') setSelectedBirdId('');
      return;
    }
    if (!orderedBirds.some((b) => b.id === selectedBirdId)) {
      setSelectedBirdId(orderedBirds[0].id);
    }
  }, [orderedBirds, selectedBirdId]);

  const selectedBird = useMemo(
    () => orderedBirds.find((b) => b.id === selectedBirdId) ?? null,
    [orderedBirds, selectedBirdId]
  );

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.stageNumber - b.stageNumber),
    [stages]
  );

  const chartData: StagePointDatum[] = useMemo(() => {
    if (!selectedBird || orderedStages.length === 0) return [];
    let runningTotal = 0;

    return orderedStages.map((stage) => {
      const ranked = computeStageRanking(stage, entries, birds, {
        scoringPositions,
        minPart1ToScore,
      });
      const found = ranked.find((r) => r.bird.id === selectedBird.id);
      const hasTenMinSongs = Boolean(
        found && found.entry.part1Songs >= minPart1ToScore
      );
      const stagePoints = found && hasTenMinSongs ? found.points : 0;
      runningTotal += stagePoints;

      return {
        stageLabel: `E${String(stage.stageNumber).padStart(2, '0')}`,
        stageNumber: stage.stageNumber,
        stageName: stage.name,
        stageDate: stage.date,
        participated: Boolean(found),
        position: found && hasTenMinSongs ? found.position : null,
        stagePoints,
        cumulativePoints: runningTotal,
        part1Songs: found?.entry.part1Songs ?? 0,
        part2Songs: found?.entry.part2Songs ?? 0,
      };
    });
  }, [
    selectedBird,
    orderedStages,
    entries,
    birds,
    scoringPositions,
    minPart1ToScore,
  ]);

  const summaryStats = useMemo(() => {
    if (chartData.length === 0) {
      return { totalPoints: 0, disputedCount: 0, bestStagePoints: 0 };
    }
    const totalPoints = chartData[chartData.length - 1].cumulativePoints;
    const disputedCount = chartData.filter((d) => d.participated).length;
    const bestStagePoints = Math.max(...chartData.map((d) => d.stagePoints), 0);
    return { totalPoints, disputedCount, bestStagePoints };
  }, [chartData]);

  if (birds.length === 0 || stages.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Evolução da pontuação por ave"
      className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3 print:break-inside-avoid"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
              Evolução da Pontuação por Etapa
            </h2>
            <p className="text-xs text-slate-500">
              Selecione uma ave para acompanhar o desempenho etapa a etapa na temporada.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          <div className="min-w-0 sm:w-64">
            <label htmlFor="evolution-bird-select" className="sr-only">
              Selecionar ave para gráfico de evolução
            </label>
            <select
              id="evolution-bird-select"
              value={selectedBirdId}
              onChange={(e) => setSelectedBirdId(e.target.value)}
              className="w-full min-h-[38px] px-2.5 py-1 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 cursor-pointer"
            >
              {orderedBirds.map((bird) => {
                const row = generalRanking.find((r) => r.bird.id === bird.id);
                const pts = row?.totalPoints ?? 0;
                const pos = row ? `${row.position}º` : '—';
                return (
                  <option key={bird.id} value={bird.id}>
                    {pos} · {bird.name} ({pts} pts)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMetric('stage')}
              className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                metric === 'stage'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Etapa
            </button>
            <button
              type="button"
              onClick={() => setMetric('cumulative')}
              className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                metric === 'cumulative'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Acumulado
            </button>
          </div>
        </div>
      </div>

      {/* Selected Bird Summary Strip */}
      {selectedBird && (
        <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Ave Selecionada
            </p>
            <p className="font-display font-bold text-slate-900 truncate">
              {selectedBird.name}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {selectedBird.ownerName}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Melhor Etapa
            </p>
            <p className="font-mono tabular-nums text-sm font-bold text-slate-900">
              {summaryStats.bestStagePoints} pts
            </p>
            <p className="text-[11px] font-mono tabular-nums text-slate-500">
              {summaryStats.disputedCount}/{orderedStages.length} etapas
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Total Acumulado
            </p>
            <p className="font-mono tabular-nums text-sm font-bold text-emerald-800">
              {summaryStats.totalPoints} pts
            </p>
          </div>
        </div>
      )}

      {/* Recharts Line Chart */}
      <div className="w-full min-w-0 h-[230px] sm:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 14, left: -16, bottom: 4 }}
          >
            <CartesianGrid
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="stageLabel"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              domain={metric === 'stage' ? [0, scoringPositions] : [0, 'auto']}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={
                <CustomChartTooltip
                  metric={metric}
                  modality={modality}
                  part1Minutes={part1Minutes}
                  part2Minutes={part2Minutes}
                />
              }
              cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone"
              dataKey={metric === 'stage' ? 'stagePoints' : 'cumulativePoints'}
              name={metric === 'stage' ? 'Pontos na etapa' : 'Pontos acumulados'}
              stroke="#047857"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{
                r: 6,
                fill: '#047857',
                stroke: '#d1fae5',
                strokeWidth: 4,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
