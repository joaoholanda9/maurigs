import {
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  Check,
  Download,
  Lock,
  RotateCcw,
  Settings2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BIRD_MODALITIES,
  type BirdModality,
  type Championship,
  type ChampionshipState,
  type ModalityRules,
  type MultiChampionshipState,
  type StageReminderConfig,
} from '../types/championship';
import {
  computeGeneralRanking,
  formatDatePtBr,
  formatScoreValue,
  isTimeScoredModality,
} from '../utils/scoring';

interface OverviewPanelProps {
  championship: Championship;
  multiState: MultiChampionshipState;
  state: ChampionshipState;
  onOpenStageTournament: (stageId: string) => void;
  onGoToStages: () => void;
  onGoToBirds: () => void;
  onGoToRanking: () => void;
  onGoToHistory: () => void;
  onCloseChampionship: (championshipId: string) => { ok: boolean; error?: string };
  onUpdateSettings: (input: {
    championshipName: string;
    seasonYear: number;
    modality?: BirdModality;
    plannedStages?: number;
    rules?: ModalityRules;
  }) => {
    ok: boolean;
    error?: string;
  };
  onUpdateStageReminder: (input: StageReminderConfig) => void;
  onImportJson: (jsonText: string) => { ok: boolean; error?: string };
  onResetToEmpty: () => void;
  onLoadSampleData: () => void;
}

const NOTIFIED_KEY = 'canto_anilha_notified_stage_v1';

function parseLocalDateOnly(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function formatDaysCountdown(diffDays: number): string {
  if (diffDays === 0) return 'É hoje!';
  if (diffDays === 1) return 'Falta 1 dia';
  return `Faltam ${diffDays} dias`;
}

export function OverviewPanel({
  championship,
  multiState,
  state,
  onOpenStageTournament,
  onGoToStages,
  onGoToBirds,
  onGoToRanking,
  onGoToHistory,
  onCloseChampionship,
  onUpdateSettings,
  onUpdateStageReminder,
  onImportJson,
  onResetToEmpty,
  onLoadSampleData,
}: OverviewPanelProps) {
  const isClosed = championship.status === 'Encerrado';
  const isTimeModality = isTimeScoredModality(championship.modality);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [nameDraft, setNameDraft] = useState(state.championshipName);
  const [yearDraft, setYearDraft] = useState(String(state.seasonYear));
  const [modalityDraft, setModalityDraft] = useState<BirdModality>(championship.modality);
  const [plannedStagesDraft, setPlannedStagesDraft] = useState(
    String(championship.plannedStages)
  );
  const [rulesDraft, setRulesDraft] = useState<ModalityRules>(championship.rules);
  const [settingsFeedback, setSettingsFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [reminderPanelOpen, setReminderPanelOpen] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);

  const reminder: StageReminderConfig = state.stageReminder ?? {
    enabled: false,
    daysBefore: 3,
    browserNotification: false,
  };

  const [reminderEnabledDraft, setReminderEnabledDraft] = useState(reminder.enabled);
  const [reminderDaysDraft, setReminderDaysDraft] = useState(String(reminder.daysBefore));
  const [browserNotifDraft, setBrowserNotifDraft] = useState(reminder.browserNotification);

  useEffect(() => {
    setNameDraft(state.championshipName);
    setYearDraft(String(state.seasonYear));
    setModalityDraft(championship.modality);
    setPlannedStagesDraft(String(championship.plannedStages));
    setRulesDraft(championship.rules);
    setConfirmCloseOpen(false);
    setConfirmClear(false);
    setSettingsFeedback(null);
  }, [
    championship.id,
    state.championshipName,
    state.seasonYear,
    championship.modality,
    championship.plannedStages,
    championship.rules,
  ]);

  useEffect(() => {
    setReminderEnabledDraft(reminder.enabled);
    setReminderDaysDraft(String(reminder.daysBefore));
    setBrowserNotifDraft(reminder.browserNotification);
  }, [reminder.enabled, reminder.daysBefore, reminder.browserNotification]);

  const orderedStages = useMemo(
    () => [...state.stages].sort((a, b) => a.stageNumber - b.stageNumber),
    [state.stages]
  );

  const nextScheduledStage = useMemo(() => {
    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = orderedStages
      .map((stage) => {
        const localDate = parseLocalDateOnly(stage.date);
        if (!localDate) return null;
        const diffDays = Math.round(
          (localDate.getTime() - todayLocal.getTime()) / 86_400_000
        );
        return { stage, diffDays };
      })
      .filter((item): item is { stage: (typeof orderedStages)[number]; diffDays: number } =>
        Boolean(item && item.diffDays >= 0)
      )
      .sort((a, b) => {
        if (a.diffDays !== b.diffDays) return a.diffDays - b.diffDays;
        return a.stage.stageNumber - b.stage.stageNumber;
      });
    return upcoming[0] ?? null;
  }, [orderedStages]);

  const isReminderAlertTriggered = Boolean(
    reminder.enabled &&
      nextScheduledStage &&
      nextScheduledStage.diffDays <= reminder.daysBefore
  );

  useEffect(() => {
    if (
      !isReminderAlertTriggered ||
      !reminder.browserNotification ||
      !nextScheduledStage ||
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const signature = `${todayKey}:${nextScheduledStage.stage.id}:${nextScheduledStage.diffDays}`;
    try {
      if (localStorage.getItem(NOTIFIED_KEY) === signature) return;
      const countdownText = formatDaysCountdown(nextScheduledStage.diffDays);
      new Notification(
        `Lembrete — Etapa ${String(nextScheduledStage.stage.stageNumber).padStart(2, '0')}`,
        {
          body: `${countdownText} para "${nextScheduledStage.stage.name}" (${formatDatePtBr(
            nextScheduledStage.stage.date
          )}).`,
        }
      );
      localStorage.setItem(NOTIFIED_KEY, signature);
    } catch {
      // Ignore notification API restrictions silently
    }
  }, [isReminderAlertTriggered, reminder.browserNotification, nextScheduledStage]);

  // Pick the latest stage with 0 scores (upcoming/live) or the latest stage overall
  const spotlightStage = useMemo(() => {
    if (orderedStages.length === 0) return null;
    const stageWithNoScores = orderedStages.find((stage) => {
      const stageEntries = state.entries.filter((e) => e.stageId === stage.id);
      if (stageEntries.length === 0) return true;
      return stageEntries.every((e) => e.part1Songs === 0 && e.part2Songs === 0);
    });
    return stageWithNoScores ?? orderedStages[orderedStages.length - 1];
  }, [orderedStages, state.entries]);

  const generalRanking = useMemo(
    () =>
      computeGeneralRanking(state.stages, state.entries, state.birds, {
        scoringPositions: championship.rules.scoringPositions,
        minPart1ToScore: championship.rules.minPart1ToScore,
      }),
    [
      state.stages,
      state.entries,
      state.birds,
      championship.rules.scoringPositions,
      championship.rules.minPart1ToScore,
    ]
  );

  const topLeaders = useMemo(() => generalRanking.slice(0, 5), [generalRanking]);
  const leader = topLeaders[0];
  const memberCount = useMemo(
    () => state.birds.filter((b) => b.isMember).length,
    [state.birds]
  );

  const spotlightEnrolledCount = useMemo(() => {
    if (!spotlightStage) return 0;
    return state.entries.filter((e) => e.stageId === spotlightStage.id).length;
  }, [spotlightStage, state.entries]);

  const best15mPerformance = useMemo(() => {
    const birdMap = new Map(state.birds.map((b) => [b.id, b]));
    const stageMap = new Map(state.stages.map((s) => [s.id, s]));

    const validEntries = state.entries
      .filter(
        (entry) =>
          entry.part2Songs > 0 &&
          birdMap.has(entry.birdId) &&
          stageMap.has(entry.stageId)
      )
      .map((entry) => ({
        entry,
        bird: birdMap.get(entry.birdId)!,
        stage: stageMap.get(entry.stageId)!,
      }));

    if (validEntries.length === 0) return null;

    validEntries.sort((a, b) => {
      if (b.entry.part2Songs !== a.entry.part2Songs) {
        return b.entry.part2Songs - a.entry.part2Songs;
      }
      if (b.entry.part1Songs !== a.entry.part1Songs) {
        return b.entry.part1Songs - a.entry.part1Songs;
      }
      if (b.stage.stageNumber !== a.stage.stageNumber) {
        return b.stage.stageNumber - a.stage.stageNumber;
      }
      return a.bird.name.localeCompare(b.bird.name, 'pt-BR');
    });

    const winner = validEntries[0];
    const tiedAtMaxCount = validEntries.filter(
      (item) => item.entry.part2Songs === winner.entry.part2Songs
    ).length;

    return {
      ...winner,
      tiedAtMaxCount,
    };
  }, [state.birds, state.stages, state.entries]);

  const handleExportBackup = (source: 'settings' | 'backup' = 'backup') => {
    const now = new Date();
    const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const blob = new Blob([JSON.stringify(multiState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canto-fibra-campeonatos-backup-${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const message = 'Backup completo dos campeonatos em JSON baixado com sucesso.';
    if (source === 'settings') {
      setSettingsFeedback({ type: 'ok', text: message });
    } else {
      setFeedback({ type: 'ok', text: message });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportJson(text);
      if (res.ok) {
        setFeedback({ type: 'ok', text: 'Dados do campeonato restaurados.' });
      } else {
        setFeedback({ type: 'err', text: res.error ?? 'Falha ao importar JSON.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onUpdateSettings({
      championshipName: nameDraft,
      seasonYear: Number(yearDraft),
      modality: modalityDraft,
      plannedStages: Number(plannedStagesDraft),
      rules: rulesDraft,
    });
    if (res.ok) {
      setSettingsFeedback({
        type: 'ok',
        text: 'Configurações atualizadas em todas as visualizações.',
      });
    } else {
      setSettingsFeedback({
        type: 'err',
        text: res.error ?? 'Erro ao salvar configurações.',
      });
    }
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDays = Math.max(
      0,
      Math.min(60, Math.floor(Number(reminderDaysDraft) || 0))
    );

    let enableBrowser = browserNotifDraft;
    let feedbackMsg = reminderEnabledDraft
      ? `Lembrete ativado para avisar com até ${parsedDays} ${
          parsedDays === 1 ? 'dia' : 'dias'
        } de antecedência.`
      : 'Lembrete desativado.';

    if (
      reminderEnabledDraft &&
      browserNotifDraft &&
      typeof window !== 'undefined' &&
      'Notification' in window
    ) {
      if (Notification.permission === 'default') {
        try {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            enableBrowser = false;
            setBrowserNotifDraft(false);
            feedbackMsg =
              'Lembrete salvo no Painel (permissão de notificação do navegador não concedida).';
          }
        } catch {
          enableBrowser = false;
          setBrowserNotifDraft(false);
        }
      } else if (Notification.permission === 'denied') {
        enableBrowser = false;
        setBrowserNotifDraft(false);
        feedbackMsg =
          'Lembrete salvo no Painel (notificações bloqueadas nas configurações do navegador).';
      }
    }

    onUpdateStageReminder({
      enabled: reminderEnabledDraft,
      daysBefore: parsedDays,
      browserNotification: enableBrowser,
    });
    setReminderFeedback(feedbackMsg);
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {isClosed && (
        <div
          role="status"
          className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-950"
        >
          <div className="flex items-start sm:items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <p>
              <strong>Campeonato Encerrado (Somente Leitura):</strong> Edições em etapas, aves e notas estão bloqueadas.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToHistory}
            className="min-h-[36px] px-3 py-1 text-xs font-semibold text-amber-950 bg-white border border-amber-300 hover:bg-amber-100 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
          >
            Abrir Histórico / Encerrados
          </button>
        </div>
      )}

      {/* Primary Focal Anchor: Active / Spotlight Stage */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            {state.eventLogoDataUrl && (
              <img
                src={state.eventLogoDataUrl}
                alt={`Logotipo ${state.championshipName}`}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0"
              />
            )}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  {state.championshipName}
                </p>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900">
                  {championship.modality}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${
                    isClosed
                      ? 'bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-sky-50 border-sky-200 text-sky-900'
                  }`}
                >
                  {championship.status}
                </span>
              </div>
            <p className="text-xs font-medium text-slate-500">
              Temporada {state.seasonYear}
              <span aria-hidden="true"> · </span>
              <span className="font-mono tabular-nums">
                {state.stages.length}/{championship.plannedStages} etapas
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                {championship.rules.part1Minutes}m / {championship.rules.part2Minutes}m · Pontuação{' '}
                {championship.rules.scoringPositions} a 1 pt
              </span>
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 text-balance">
              {spotlightStage
                ? `Etapa ${String(spotlightStage.stageNumber).padStart(2, '0')} — ${spotlightStage.name}`
                : state.championshipName}
            </h1>
            {spotlightStage ? (
              <p className="text-xs sm:text-sm text-slate-600">
                <span className="font-mono tabular-nums font-medium text-slate-800">
                  {formatDatePtBr(spotlightStage.date)}
                </span>
                <span aria-hidden="true"> · </span>
                <span>{spotlightStage.address}</span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono tabular-nums">
                  {spotlightEnrolledCount} aves inscritas
                </span>
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-slate-600">
                Cadastre as aves competidoras e crie a primeira etapa para iniciar a contagem dos torneios.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setReminderPanelOpen((prev) => !prev);
                setReminderFeedback(null);
              }}
              aria-expanded={reminderPanelOpen}
              aria-label="Definir lembrete para a próxima etapa"
              title="Lembrete da próxima etapa"
              className={`relative min-h-[44px] px-3 py-2 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold rounded-xl border transition-colors whitespace-nowrap cursor-pointer ${
                isReminderAlertTriggered
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  : reminder.enabled
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isReminderAlertTriggered ? (
                <BellRing className="w-4 h-4 text-amber-600 shrink-0" />
              ) : reminder.enabled ? (
                <Bell className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span className="font-mono tabular-nums">
                {nextScheduledStage
                  ? formatDaysCountdown(nextScheduledStage.diffDays)
                  : 'Lembrete'}
              </span>
              {isReminderAlertTriggered && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-amber-500 shrink-0"
                />
              )}
            </button>

            {spotlightStage ? (
              <button
                type="button"
                onClick={() => onOpenStageTournament(spotlightStage.id)}
                className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Abrir Mesa do Torneio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoToStages}
                className="flex-1 sm:flex-none min-h-[44px] px-4 py-2.5 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Cadastrar 1ª Etapa</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Active Stage Reminder Banner (shown when reminder is active and upcoming stage exists) */}
        {reminder.enabled && nextScheduledStage && (
          <div
            role="status"
            className={`rounded-xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              isReminderAlertTriggered
                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              {isReminderAlertTriggered ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <CalendarClock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div className="min-w-0 text-xs">
                <p className="font-semibold truncate">
                  Próxima etapa: Etapa{' '}
                  {String(nextScheduledStage.stage.stageNumber).padStart(2, '0')} —{' '}
                  {nextScheduledStage.stage.name}
                </p>
                <p
                  className={
                    isReminderAlertTriggered ? 'text-amber-900' : 'text-emerald-900/90'
                  }
                >
                  Data agendada:{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {formatDatePtBr(nextScheduledStage.stage.date)}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    Aviso configurado para{' '}
                    <strong className="font-mono tabular-nums">
                      {reminder.daysBefore === 0
                        ? 'o dia do evento'
                        : `${reminder.daysBefore} ${
                            reminder.daysBefore === 1 ? 'dia' : 'dias'
                          } antes`}
                    </strong>
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <span
                className={`font-mono tabular-nums text-xs sm:text-sm font-bold px-2.5 py-1 rounded-lg border ${
                  isReminderAlertTriggered
                    ? 'bg-white border-amber-300 text-amber-900'
                    : 'bg-white border-emerald-200 text-emerald-900'
                }`}
              >
                {formatDaysCountdown(nextScheduledStage.diffDays)}
              </span>

              <button
                type="button"
                onClick={() => setReminderPanelOpen((prev) => !prev)}
                className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 whitespace-nowrap cursor-pointer"
              >
                {reminderPanelOpen ? 'Fechar' : 'Ajustar'}
              </button>
            </div>
          </div>
        )}

        {/* Inline Reminder Configuration Panel (toggled via Alert / Bell Icon) */}
        {reminderPanelOpen && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BellRing className="w-4 h-4 text-emerald-700 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Lembrete da Próxima Etapa
                  </h2>
                  <p className="text-xs text-slate-600">
                    {nextScheduledStage ? (
                      <>
                        Etapa{' '}
                        <span className="font-mono tabular-nums font-semibold">
                          {String(nextScheduledStage.stage.stageNumber).padStart(2, '0')}
                        </span>{' '}
                        em{' '}
                        <span className="font-mono tabular-nums font-semibold">
                          {formatDatePtBr(nextScheduledStage.stage.date)}
                        </span>{' '}
                        —{' '}
                        <strong className="font-mono tabular-nums text-emerald-800">
                          {formatDaysCountdown(nextScheduledStage.diffDays)}
                        </strong>
                      </>
                    ) : (
                      'Nenhuma etapa com data futura agendada no momento.'
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReminderPanelOpen(false)}
                aria-label="Fechar configuração de lembrete"
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveReminder}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
            >
              <div className="sm:col-span-4">
                <label className="flex items-center gap-2 min-h-[40px] px-3 py-1.5 bg-white border border-slate-200 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={reminderEnabledDraft}
                    onChange={(e) => {
                      setReminderEnabledDraft(e.target.checked);
                      setReminderFeedback(null);
                    }}
                    className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Ativar alerta no Painel
                  </span>
                </label>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="reminder-days-select"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Avisar a partir de
                </label>
                <select
                  id="reminder-days-select"
                  value={reminderDaysDraft}
                  onChange={(e) => {
                    setReminderDaysDraft(e.target.value);
                    setReminderFeedback(null);
                  }}
                  disabled={!reminderEnabledDraft}
                  className="w-full min-h-[40px] px-2.5 text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  <option value="0">No dia da etapa (0 dias)</option>
                  <option value="1">1 dia antes</option>
                  <option value="2">2 dias antes</option>
                  <option value="3">3 dias antes</option>
                  <option value="5">5 dias antes</option>
                  <option value="7">7 dias antes</option>
                  <option value="15">15 dias antes</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="flex items-center gap-2 min-h-[40px] px-3 py-1.5 bg-white border border-slate-200 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={browserNotifDraft}
                    disabled={!reminderEnabledDraft}
                    onChange={(e) => {
                      setBrowserNotifDraft(e.target.checked);
                      setReminderFeedback(null);
                    }}
                    className="w-4 h-4 accent-emerald-700 rounded cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Notificação navegador
                  </span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full min-h-[40px] px-3 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar</span>
                </button>
              </div>
            </form>

            {reminderFeedback && (
              <p className="text-xs font-medium text-emerald-800">{reminderFeedback}</p>
            )}
          </div>
        )}
      </section>

      {/* 4-Column KPI Strip */}
      <section aria-label="Resumo da temporada" className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onGoToBirds}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3 sm:p-4 transition-colors cursor-pointer"
        >
          <p className="text-[11px] sm:text-xs font-medium text-slate-500">Aves Cadastradas</p>
          <p className="mt-1 font-mono tabular-nums text-xl sm:text-2xl font-bold text-slate-900">
            {state.birds.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600 font-mono tabular-nums truncate">
            {memberCount} sócios · {state.birds.length - memberCount} não sócios
          </p>
        </button>

        <button
          type="button"
          onClick={onGoToStages}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3 sm:p-4 transition-colors cursor-pointer"
        >
          <p className="text-[11px] sm:text-xs font-medium text-slate-500">Etapas do Ano</p>
          <p className="mt-1 font-mono tabular-nums text-xl sm:text-2xl font-bold text-slate-900">
            {state.stages.length}
            <span className="text-sm font-normal text-slate-400">
              /{championship.plannedStages}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600 truncate">
            Calendário anual ({championship.modality})
          </p>
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500">Participações</p>
          <p className="mt-1 font-mono tabular-nums text-xl sm:text-2xl font-bold text-slate-900">
            {state.entries.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600 truncate">
            Inscrições somadas
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToRanking}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-3 sm:p-4 transition-colors cursor-pointer"
        >
          <p className="text-[11px] sm:text-xs font-medium text-slate-500">Líder Geral</p>
          <p className="mt-1 font-display text-base sm:text-lg font-bold text-slate-900 truncate">
            {leader && leader.totalPoints > 0 ? leader.bird.name : '—'}
          </p>
          <p className="mt-0.5 text-[11px] font-mono tabular-nums text-emerald-800 font-semibold truncate">
            {leader && leader.totalPoints > 0
              ? `${leader.totalPoints} pts acumulados`
              : 'Sem pontuações'}
          </p>
        </button>
      </section>

      {/* Best 15-Minute Performance Highlight Card */}
      <section
        aria-label={
          isTimeModality
            ? 'Melhor tempo nos 15 minutos'
            : 'Melhor cantada nos 15 minutos'
        }
        className="bg-white border border-sky-200 rounded-2xl p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Award className="w-4 h-4 text-sky-700 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
                {isTimeModality
                  ? `Melhor Tempo nos ${championship.rules.part2Minutes} Minutos`
                  : `Melhor Cantada nos ${championship.rules.part2Minutes} Minutos`}
              </h2>
              <p className="text-xs text-slate-500">
                Maior marca registrada na 2ª parte entre todas as etapas da temporada.
              </p>
            </div>
          </div>

          {best15mPerformance && (
            <button
              type="button"
              onClick={() => onOpenStageTournament(best15mPerformance.stage.id)}
              className="self-start sm:self-auto min-h-[40px] px-3.5 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Abrir Etapa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {best15mPerformance ? (
            <>
              <div className="min-w-0 space-y-1">
                <p className="font-display text-lg sm:text-xl font-bold text-slate-900 truncate">
                  {best15mPerformance.bird.name}
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-medium text-slate-800">
                    {best15mPerformance.bird.ownerName}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {best15mPerformance.bird.isMember ? 'Sócio' : 'Não sócio'}
                  </span>
                  {best15mPerformance.entry.stakeNumber && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">
                        Estaca {best15mPerformance.entry.stakeNumber}
                      </span>
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    Etapa {String(best15mPerformance.stage.stageNumber).padStart(2, '0')} —{' '}
                    {best15mPerformance.stage.name}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono tabular-nums">
                    {formatDatePtBr(best15mPerformance.stage.date)}
                  </span>
                </p>
                {best15mPerformance.tiedAtMaxCount > 1 && (
                  <p className="text-[11px] text-slate-500">
                    +{best15mPerformance.tiedAtMaxCount - 1}{' '}
                    {best15mPerformance.tiedAtMaxCount - 1 === 1
                      ? 'registro empatado'
                      : 'registros empatados'}{' '}
                    com{' '}
                    <span className="font-mono tabular-nums">
                      {formatScoreValue(
                        best15mPerformance.entry.part2Songs,
                        championship.modality
                      )}
                    </span>{' '}
                    {isTimeModality
                      ? `(desempate pela marca dos ${championship.rules.part1Minutes}m).`
                      : `cantos (desempate pela marca dos ${championship.rules.part1Minutes}m).`}
                  </p>
                )}
              </div>

              <div className="sm:text-right shrink-0 flex sm:flex-col items-baseline sm:items-end justify-between gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div>
                  <span className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-sky-900">
                    {formatScoreValue(
                      best15mPerformance.entry.part2Songs,
                      championship.modality
                    )}
                  </span>
                  <span className="ml-1.5 text-xs font-semibold text-sky-800">
                    {isTimeModality
                      ? `tempo (${championship.rules.part2Minutes}m)`
                      : `cantos (${championship.rules.part2Minutes}m)`}
                  </span>
                </div>
                <p className="text-xs font-mono tabular-nums text-slate-500">
                  {formatScoreValue(
                    best15mPerformance.entry.part1Songs,
                    championship.modality
                  )}{' '}
                  {isTimeModality
                    ? `nos ${championship.rules.part1Minutes}m`
                    : `cantos nos ${championship.rules.part1Minutes}m`}
                </p>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between gap-3 py-1">
              <div className="space-y-0.5">
                <p className="font-display text-base font-bold text-slate-400">—</p>
                <p className="text-xs text-slate-500">
                  Sem registros nos {championship.rules.part2Minutes}m até o momento. Lance a 2ª parte em uma etapa para destacar o recorde.
                </p>
              </div>
              <span className="font-mono tabular-nums text-xl font-bold text-slate-300 shrink-0">
                {isTimeModality ? '0:00.0' : '0 cantos'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Top 5 General Standings Preview */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
              Classificação Geral — Top 5
            </h2>
            <p className="text-xs text-slate-500">
              Soma automática de todas as etapas ·{' '}
              {isTimeModality
                ? 'Desempate por maior tempo total.'
                : 'Desempate por maior total de cantos.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToRanking}
            className="min-h-[38px] px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 rounded-xl whitespace-nowrap cursor-pointer"
          >
            Ver completo
          </button>
        </div>

        {topLeaders.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-600">
            {isTimeModality
              ? 'Cadastre aves e registre os tempos (0:00.0) das etapas para acompanhar o ranking anual.'
              : 'Cadastre aves e registre os cantos das etapas para acompanhar o ranking anual.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {topLeaders.map((row) => (
              <div
                key={row.bird.id}
                className="px-4 py-2.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="font-mono tabular-nums text-sm font-bold text-slate-900 w-6 shrink-0">
                    {row.position}º
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">
                      {row.bird.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      <span>{row.bird.ownerName}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{row.bird.isMember ? 'Sócio' : 'Não sócio'}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-mono tabular-nums text-sm font-bold text-emerald-800">
                    {row.totalPoints} pts
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500">
                    {row.stagesDisputed} etapas ·{' '}
                    {formatScoreValue(row.totalSongs, championship.modality)}
                    {isTimeModality ? '' : ' cantos'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Championship Settings & Close Championship */}
      <section
        aria-label="Configurações do campeonato"
        className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3.5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">
                Configurações e Regras do Campeonato
              </h2>
              <p className="text-xs text-slate-500">
                Modalidade, etapas previstas, tempos de marcação e encerramento oficial da temporada.
              </p>
            </div>
          </div>

          {!isClosed && !confirmCloseOpen && (
            <button
              type="button"
              onClick={() => setConfirmCloseOpen(true)}
              className="self-start sm:self-auto min-h-[38px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Encerrar Campeonato</span>
            </button>
          )}
        </div>

        {confirmCloseOpen && !isClosed && (
          <div
            role="alertdialog"
            aria-label="Confirmar encerramento do campeonato"
            className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 space-y-1">
                <p className="font-bold">
                  Encerrar &ldquo;{championship.name}&rdquo;?
                </p>
                <p>
                  O status será alterado para <strong>Encerrado</strong>, bloqueando edições nas etapas, estacas, aves e notas. O resultado completo ficará disponível em modo somente leitura na aba{' '}
                  <strong>Histórico / Encerrados</strong>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(false)}
                className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseChampionship(championship.id);
                  setConfirmCloseOpen(false);
                }}
                className="min-h-[38px] px-4 py-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-xl cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Confirmar Encerramento</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-5">
              <label
                htmlFor="championship-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nome do Campeonato
              </label>
              <input
                id="championship-name-input"
                type="text"
                required
                disabled={isClosed}
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  if (settingsFeedback) setSettingsFeedback(null);
                }}
                placeholder="Ex.: Campeonato 2026 - Coleiro"
                className="w-full min-h-[40px] px-3 py-1.5 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 disabled:opacity-60"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="championship-modality-select"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Modalidade
              </label>
              <select
                id="championship-modality-select"
                disabled={isClosed}
                value={modalityDraft}
                onChange={(e) => {
                  setModalityDraft(e.target.value as BirdModality);
                  if (settingsFeedback) setSettingsFeedback(null);
                }}
                className="w-full min-h-[40px] px-2.5 py-1.5 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 disabled:opacity-60 cursor-pointer"
              >
                {BIRD_MODALITIES.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="championship-year-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Temporada
              </label>
              <input
                id="championship-year-input"
                type="number"
                min={2000}
                max={2100}
                inputMode="numeric"
                required
                disabled={isClosed}
                value={yearDraft}
                onChange={(e) => {
                  setYearDraft(e.target.value);
                  if (settingsFeedback) setSettingsFeedback(null);
                }}
                className="w-full min-h-[40px] px-3 py-1.5 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 disabled:opacity-60"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="championship-planned-stages"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Etapas Prev.
              </label>
              <input
                id="championship-planned-stages"
                type="number"
                min={Math.max(1, state.stages.length)}
                max={60}
                inputMode="numeric"
                required
                disabled={isClosed}
                value={plannedStagesDraft}
                onChange={(e) => {
                  setPlannedStagesDraft(e.target.value);
                  if (settingsFeedback) setSettingsFeedback(null);
                }}
                className="w-full min-h-[40px] px-3 py-1.5 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5">
            <div className="sm:col-span-2">
              <label
                htmlFor="rules-p1-min"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                1ª Parte (min)
              </label>
              <input
                id="rules-p1-min"
                type="number"
                min={1}
                max={120}
                disabled={isClosed}
                value={rulesDraft.part1Minutes}
                onChange={(e) =>
                  setRulesDraft((prev) => ({
                    ...prev,
                    part1Minutes: Math.max(1, Number(e.target.value) || 10),
                  }))
                }
                className="w-full min-h-[38px] px-2 text-center font-mono tabular-nums text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg disabled:opacity-60"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="rules-p2-min"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                2ª Parte (min)
              </label>
              <input
                id="rules-p2-min"
                type="number"
                min={1}
                max={120}
                disabled={isClosed}
                value={rulesDraft.part2Minutes}
                onChange={(e) =>
                  setRulesDraft((prev) => ({
                    ...prev,
                    part2Minutes: Math.max(1, Number(e.target.value) || 15),
                  }))
                }
                className="w-full min-h-[38px] px-2 text-center font-mono tabular-nums text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg disabled:opacity-60"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="rules-scoring-pos"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Posições Pont.
              </label>
              <input
                id="rules-scoring-pos"
                type="number"
                min={1}
                max={100}
                disabled={isClosed}
                value={rulesDraft.scoringPositions}
                onChange={(e) =>
                  setRulesDraft((prev) => ({
                    ...prev,
                    scoringPositions: Math.max(1, Number(e.target.value) || 30),
                  }))
                }
                className="w-full min-h-[38px] px-2 text-center font-mono tabular-nums text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg disabled:opacity-60"
              />
            </div>

            <div className="sm:col-span-6">
              <label
                htmlFor="rules-notes-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Regras da Modalidade
              </label>
              <input
                id="rules-notes-input"
                type="text"
                disabled={isClosed}
                value={rulesDraft.rulesNotes}
                onChange={(e) =>
                  setRulesDraft((prev) => ({ ...prev, rulesNotes: e.target.value }))
                }
                className="w-full min-h-[38px] px-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleExportBackup('settings')}
              className="min-h-[40px] px-3.5 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup JSON</span>
            </button>

            {!isClosed && (
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Configurações</span>
              </button>
            )}
          </div>
        </form>

        {settingsFeedback && (
          <p
            className={`text-xs font-medium ${
              settingsFeedback.type === 'ok' ? 'text-emerald-800' : 'text-red-700'
            }`}
          >
            {settingsFeedback.text}
          </p>
        )}
      </section>

      {/* Data Backup & Season Controls */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">
              Cópia de Segurança e Temporada
            </h2>
            <p className="text-xs text-slate-500">
              Os dados de todos os campeonatos ficam salvos no dispositivo para uso offline. Exporte backups quando necessário.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportBackup('backup')}
              className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar JSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            {!isClosed && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onLoadSampleData();
                    setFeedback({ type: 'ok', text: 'Dados de exemplo carregados.' });
                  }}
                  className="min-h-[40px] px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Carregar Exemplo</span>
                </button>

                {confirmClear ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onResetToEmpty();
                        setConfirmClear(false);
                        setFeedback({
                          type: 'ok',
                          text: 'Etapas e notas deste campeonato zeradas.',
                        });
                      }}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer"
                    >
                      Confirmar Limpeza
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 border border-red-200 rounded-xl cursor-pointer"
                  >
                    Zerar Dados
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {feedback && (
          <p
            className={`text-xs font-medium ${
              feedback.type === 'ok' ? 'text-emerald-800' : 'text-red-700'
            }`}
          >
            {feedback.text}
          </p>
        )}
      </section>
    </div>
  );
}
