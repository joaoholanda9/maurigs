import { Bell, BellOff, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ActiveRound, Bird, BirdModality, StageEntry } from '../types/championship';
import { formatScoreValue, isTimeScoredModality } from '../utils/scoring';
import { TimeScoreInput } from './TimeScoreInput';

interface TimerHookReturn {
  activeRound: ActiveRound;
  secondsLeft: number;
  isRunning: boolean;
  isFinished: boolean;
  soundEnabled: boolean;
  part1Minutes: number;
  part2Minutes: number;
  setSoundEnabled: (v: boolean) => void;
  selectRound: (round: ActiveRound) => void;
  toggleRun: () => void;
  resetTimer: () => void;
  formattedTime: string;
  progressPercent: number;
}

function playFinishChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [0, 0.28, 0.56].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now + offset);
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.24);
    });
  } catch {
    // Ignore audio context restrictions
  }
}

export function useStageTimer(
  part1Minutes = 10,
  part2Minutes = 15
): TimerHookReturn {
  const safeP1 = Math.max(1, Math.floor(part1Minutes || 10));
  const safeP2 = Math.max(1, Math.floor(part2Minutes || 15));
  const [activeRound, setActiveRound] = useState<ActiveRound>('part1');
  const [secondsLeft, setSecondsLeft] = useState<number>(safeP1 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  useEffect(() => {
    setIsRunning(false);
    setSecondsLeft((activeRound === 'part1' ? safeP1 : safeP2) * 60);
  }, [safeP1, safeP2]);

  const totalSeconds = (activeRound === 'part1' ? safeP1 : safeP2) * 60;

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          if (soundRef.current) {
            playFinishChime();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const selectRound = (round: ActiveRound) => {
    setIsRunning(false);
    setActiveRound(round);
    setSecondsLeft((round === 'part1' ? safeP1 : safeP2) * 60);
  };

  const toggleRun = () => {
    if (secondsLeft === 0) {
      setSecondsLeft(totalSeconds);
      setIsRunning(true);
      return;
    }
    setIsRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(totalSeconds);
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const progressPercent = Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100);

  return {
    activeRound,
    secondsLeft,
    isRunning,
    isFinished: secondsLeft === 0,
    soundEnabled,
    part1Minutes: safeP1,
    part2Minutes: safeP2,
    setSoundEnabled,
    selectRound,
    toggleRun,
    resetTimer,
    formattedTime,
    progressPercent,
  };
}

interface StageStopwatchProps {
  timer: TimerHookReturn;
}

export function StageStopwatch({ timer }: StageStopwatchProps) {
  return (
    <section
      aria-label="Cronômetro oficial da etapa"
      className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Preset Selector + Status */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => timer.selectRound('part1')}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timer.activeRound === 'part1'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1ª Parte · {timer.part1Minutes}m
            </button>
            <button
              type="button"
              onClick={() => timer.selectRound('part2')}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timer.activeRound === 'part2'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2ª Parte · {timer.part2Minutes}m
            </button>
          </div>

          <button
            type="button"
            onClick={() => timer.setSoundEnabled(!timer.soundEnabled)}
            aria-label={
              timer.soundEnabled ? 'Desativar alerta sonoro' : 'Ativar alerta sonoro'
            }
            className="min-h-[36px] px-2.5 py-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {timer.soundEnabled ? (
              <>
                <Bell className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline">Alarme</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Mudo</span>
              </>
            )}
          </button>
        </div>

        {/* Countdown Display + Controls */}
        <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono tabular-nums text-2xl sm:text-3xl font-bold tracking-tight ${
                timer.isFinished
                  ? 'text-amber-700'
                  : timer.isRunning
                    ? 'text-emerald-800'
                    : 'text-slate-900'
              }`}
            >
              {timer.formattedTime}
            </span>
            <span className="text-[11px] text-slate-500 whitespace-nowrap">
              {timer.isFinished
                ? 'Encerrado'
                : timer.activeRound === 'part1'
                  ? `${timer.part1Minutes} min`
                  : `${timer.part2Minutes} min`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={timer.toggleRun}
              className={`min-h-[40px] px-3.5 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98] ${
                timer.isRunning
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              {timer.isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>{timer.isFinished ? 'Reiniciar' : 'Iniciar'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={timer.resetTimer}
              aria-label="Zerar cronômetro"
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Track */}
      <div className="mt-2.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            timer.isFinished ? 'bg-amber-600' : 'bg-emerald-700'
          }`}
          style={{ width: `${timer.progressPercent}%` }}
        />
      </div>
    </section>
  );
}

interface JudgeFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  modality?: BirdModality;
  timer: TimerHookReturn;
  items: { entry: StageEntry; bird: Bird }[];
  focusedEntryId: string | null;
  onSelectEntry: (entryId: string) => void;
  onIncrement: (entryId: string, field: 'part1Songs' | 'part2Songs', delta: number) => void;
  onUpdateExact: (entryId: string, field: 'part1Songs' | 'part2Songs', value: number) => void;
}

export function JudgeFocusModal({
  isOpen,
  onClose,
  modality,
  timer,
  items,
  focusedEntryId,
  onSelectEntry,
  onIncrement,
  onUpdateExact,
}: JudgeFocusModalProps) {
  const isTimeModality = isTimeScoredModality(modality);
  const [isTimingBird, setIsTimingBird] = useState(false);

  const currentIndex = Math.max(
    0,
    items.findIndex((item) => item.entry.id === focusedEntryId)
  );
  const current = items[currentIndex] ?? items[0];
  const field: 'part1Songs' | 'part2Songs' =
    timer.activeRound === 'part1' ? 'part1Songs' : 'part2Songs';

  useEffect(() => {
    setIsTimingBird(false);
  }, [isOpen, focusedEntryId, timer.activeRound, isTimeModality]);

  useEffect(() => {
    if (!isOpen || !isTimeModality || !isTimingBird || !current) return;
    const entryId = current.entry.id;
    const id = window.setInterval(() => {
      onIncrement(entryId, field, 1);
    }, 100);
    return () => window.clearInterval(id);
  }, [isOpen, isTimeModality, isTimingBird, current?.entry.id, field, onIncrement]);

  if (!isOpen || items.length === 0) return null;

  const currentValue = current.entry[field];

  const handlePrev = () => {
    setIsTimingBird(false);
    const prevIdx = (currentIndex - 1 + items.length) % items.length;
    onSelectEntry(items[prevIdx].entry.id);
  };

  const handleNext = () => {
    setIsTimingBird(false);
    const nextIdx = (currentIndex + 1) % items.length;
    onSelectEntry(items[nextIdx].entry.id);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        isTimeModality
          ? 'Modo Mesa de Marcação por Tempo em Tempo Real'
          : 'Modo Mesa de Contagem em Tempo Real'
      }
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
        {/* Drag handle mobile */}
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              {isTimeModality ? 'Mesa de Marcação (0:00.0)' : 'Mesa de Contagem'}
            </h3>
            <p className="text-xs text-slate-500">
              Competidor {currentIndex + 1} de {items.length}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar mesa de contagem"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Compact Synchronized Timer */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => timer.selectRound('part1')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                  timer.activeRound === 'part1'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {timer.part1Minutes} min
              </button>
              <button
                type="button"
                onClick={() => timer.selectRound('part2')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                  timer.activeRound === 'part2'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {timer.part2Minutes} min
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`font-mono tabular-nums text-xl font-bold ${
                  timer.isFinished
                    ? 'text-amber-700'
                    : timer.isRunning
                      ? 'text-emerald-800'
                      : 'text-slate-900'
                }`}
              >
                {timer.formattedTime}
              </span>
              <button
                type="button"
                onClick={timer.toggleRun}
                aria-label={timer.isRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer"
              >
                {timer.isRunning ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Active Bird Switcher */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Ave anterior"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center min-w-0 flex-1">
              <p className="font-display text-lg font-bold text-slate-900 truncate">
                {current.bird.name}
              </p>
              <p className="text-xs text-slate-500 truncate">
                <span className="font-mono font-medium text-slate-700">
                  {current.entry.stakeNumber
                    ? `Estaca ${current.entry.stakeNumber}`
                    : 'Sem estaca'}
                </span>
                <span aria-hidden="true"> · </span>
                <span>{current.bird.ownerName}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Próxima ave"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Big Score Readout + Editable Value */}
          <div className="text-center py-2">
            <p className="text-xs font-medium text-slate-500">
              {timer.activeRound === 'part1'
                ? `1ª Parte (Classificatória · ${timer.part1Minutes} min)`
                : `2ª Parte (Final · ${timer.part2Minutes} min)`}
            </p>
            {isTimeModality ? (
              <div className="mt-2 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onIncrement(current.entry.id, field, -1)}
                  aria-label="Remover 0.1 segundo"
                  className="min-h-[48px] min-w-[56px] px-2.5 rounded-xl border border-slate-200 text-sm font-mono font-semibold text-slate-700 hover:bg-slate-100 active:scale-[0.97] transition-transform cursor-pointer"
                >
                  -0.1s
                </button>

                <TimeScoreInput
                  value={currentValue}
                  ariaLabel="Tempo de canto em minutos, segundos e décimos"
                  onChangeValue={(nextTenths) =>
                    onUpdateExact(current.entry.id, field, nextTenths)
                  }
                  className="w-36 h-16 text-center font-mono tabular-nums text-3xl font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />

                <button
                  type="button"
                  onClick={() => onIncrement(current.entry.id, field, 1)}
                  aria-label="Adicionar 0.1 segundo"
                  className="min-h-[48px] min-w-[56px] px-2.5 rounded-xl border border-slate-200 text-sm font-mono font-semibold text-slate-700 hover:bg-slate-100 active:scale-[0.97] transition-transform cursor-pointer"
                >
                  +0.1s
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onIncrement(current.entry.id, field, -1)}
                  aria-label="Remover 1 canto"
                  className="min-h-[48px] min-w-[56px] px-3 rounded-xl border border-slate-200 text-base font-semibold text-slate-700 hover:bg-slate-100 active:scale-[0.97] transition-transform cursor-pointer"
                >
                  -1
                </button>

                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  aria-label="Quantidade de cantos"
                  value={currentValue}
                  onChange={(e) =>
                    onUpdateExact(current.entry.id, field, Number(e.target.value))
                  }
                  className="w-28 h-16 text-center font-mono tabular-nums text-4xl font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />

                <span className="text-xs text-slate-500 text-left leading-tight w-14">
                  cantos
                </span>
              </div>
            )}
          </div>

          {/* Giant Ergonomic Tap Button */}
          {isTimeModality ? (
            <button
              type="button"
              onClick={() => setIsTimingBird((prev) => !prev)}
              className={`w-full min-h-[84px] rounded-2xl active:scale-[0.98] text-white font-display text-xl sm:text-2xl font-bold tracking-tight transition-all cursor-pointer shadow-sm inline-flex items-center justify-center gap-2.5 ${
                isTimingBird
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {isTimingBird ? (
                <>
                  <Pause className="w-6 h-6" />
                  <span>Pausar Marcação</span>
                </>
              ) : (
                <>
                  <Play className="w-6 h-6" />
                  <span>Iniciar Marcação (0:00.0)</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onIncrement(current.entry.id, field, 1)}
              className="w-full min-h-[84px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-display text-2xl font-bold tracking-tight transition-all cursor-pointer shadow-sm"
            >
              +1 Canto
            </button>
          )}

          {/* Other round summary */}
          <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
            <span>
              1ª Parte ({timer.part1Minutes} min):{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatScoreValue(current.entry.part1Songs, modality)}
              </strong>
            </span>
            <span>
              2ª Parte ({timer.part2Minutes} min):{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatScoreValue(current.entry.part2Songs, modality)}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
