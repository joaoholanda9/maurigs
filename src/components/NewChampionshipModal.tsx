import { Feather, Plus, Settings2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  BIRD_MODALITIES,
  type BirdModality,
  type ModalityRules,
} from '../types/championship';
import { getDefaultModalityRules } from '../utils/scoring';

interface NewChampionshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    modality: BirdModality;
    seasonYear: number;
    plannedStages: number;
    rules: ModalityRules;
  }) => { ok: boolean; error?: string };
}

export function NewChampionshipModal({
  isOpen,
  onClose,
  onCreate,
}: NewChampionshipModalProps) {
  const currentYear = new Date().getFullYear();
  const [modality, setModality] = useState<BirdModality>('Coleiro');
  const [seasonYear, setSeasonYear] = useState<number>(currentYear);
  const [name, setName] = useState<string>(`Campeonato ${currentYear} - Coleiro`);
  const [nameTouched, setNameTouched] = useState(false);
  const [plannedStages, setPlannedStages] = useState<number>(26);
  const [rules, setRules] = useState<ModalityRules>(() =>
    getDefaultModalityRules('Coleiro')
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const yr = new Date().getFullYear();
      setModality('Coleiro');
      setSeasonYear(yr);
      setName(`Campeonato ${yr} - Coleiro`);
      setNameTouched(false);
      setPlannedStages(26);
      setRules(getDefaultModalityRules('Coleiro'));
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleModalityChange = (nextModality: BirdModality) => {
    setModality(nextModality);
    setRules(getDefaultModalityRules(nextModality));
    if (!nameTouched) {
      setName(`Campeonato ${seasonYear} - ${nextModality}`);
    }
  };

  const handleYearChange = (nextYearStr: string) => {
    const parsed = Number(nextYearStr);
    setSeasonYear(parsed);
    if (!nameTouched && Number.isFinite(parsed) && parsed >= 2000) {
      setName(`Campeonato ${Math.floor(parsed)} - ${modality}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onCreate({
      name,
      modality,
      seasonYear,
      plannedStages,
      rules,
    });
    if (!res.ok) {
      setError(res.error ?? 'Não foi possível criar o campeonato.');
      return;
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Criar novo campeonato"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 shrink-0" />

        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Feather className="w-4 h-4 text-emerald-700 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-slate-900 truncate">
                Novo Campeonato
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Crie um torneio simultâneo em qualquer modalidade com regras próprias.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 text-xs font-medium text-red-900 bg-red-50 border border-red-200 rounded-xl"
            >
              {error}
            </div>
          )}

          {/* Modality Selector */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Modalidade
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BIRD_MODALITIES.filter((mod) => mod !== 'Papa-Capim').map((mod) => {
                const selected = modality === mod;
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => handleModalityChange(mod)}
                    className={`min-h-[40px] px-3 py-2 text-xs font-semibold rounded-xl border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-1 ring-emerald-600'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {mod}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label
              htmlFor="new-champ-name"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Nome do Campeonato
            </label>
            <input
              id="new-champ-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex.: Campeonato 2026 - Trinca-Ferro"
              className="w-full min-h-[42px] px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Year & Planned Stages */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="new-champ-year"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Ano / Temporada
              </label>
              <input
                id="new-champ-year"
                type="number"
                min={2000}
                max={2100}
                required
                value={seasonYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label
                htmlFor="new-champ-stages"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Total de Etapas Previstas
              </label>
              <input
                id="new-champ-stages"
                type="number"
                min={1}
                max={60}
                required
                value={plannedStages}
                onChange={(e) => setPlannedStages(Number(e.target.value))}
                className="w-full min-h-[42px] px-3 py-2 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          {/* Modality Rules */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-800">
                Configurações / Regras da Modalidade ({modality})
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="new-champ-p1"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  1ª Parte (min)
                </label>
                <input
                  id="new-champ-p1"
                  type="number"
                  min={1}
                  max={120}
                  value={rules.part1Minutes}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      part1Minutes: Math.max(1, Number(e.target.value) || 10),
                    }))
                  }
                  className="w-full min-h-[38px] px-2 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label
                  htmlFor="new-champ-p2"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  2ª Parte (min)
                </label>
                <input
                  id="new-champ-p2"
                  type="number"
                  min={1}
                  max={120}
                  value={rules.part2Minutes}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      part2Minutes: Math.max(1, Number(e.target.value) || 15),
                    }))
                  }
                  className="w-full min-h-[38px] px-2 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label
                  htmlFor="new-champ-pos"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Posições Pont.
                </label>
                <input
                  id="new-champ-pos"
                  type="number"
                  min={1}
                  max={100}
                  value={rules.scoringPositions}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      scoringPositions: Math.max(1, Number(e.target.value) || 30),
                    }))
                  }
                  className="w-full min-h-[38px] px-2 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="new-champ-notes"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Resumo das Regras
              </label>
              <textarea
                id="new-champ-notes"
                rows={2}
                value={rules.rulesNotes}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, rulesNotes: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Campeonato</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
