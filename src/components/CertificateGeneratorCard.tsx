import { Award, FileText, ImageDown, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_EVENT_LOGO_URL } from '../hooks/useChampionshipStore';
import type { Bird, BirdModality, Stage, StageEntry } from '../types/championship';
import {
  buildBotanicalCornerDataUrl,
  buildCertificateWatermarkDataUrl,
} from '../utils/certificateBackdrop';
import {
  type CertificateData,
  exportCertificateToPdf,
  exportCertificateToPng,
  getCertificateCustomWatermarkUrl,
} from '../utils/certificateExport';
import {
  loadTrimmedPresidentSignature,
  PRESIDENT_SIGNATURE_PATH,
} from '../utils/certificateSignature';
import {
  loadImageElement,
  trimTransparentImageCanvas,
} from '../utils/reportCanvasHelpers';
import {
  computeStageRanking,
  formatDatePtBr,
  formatScoreValue,
  getModalityTopLimit,
  isTimeScoredModality,
} from '../utils/scoring';

interface CertificateGeneratorCardProps {
  championshipName: string;
  seasonYear: number;
  modality?: BirdModality;
  stages: Stage[];
  birds: Bird[];
  entries: StageEntry[];
  eventLogoDataUrl?: string;
  onUpdateEventLogo?: (logoDataUrl: string | undefined) => void;
  readOnly?: boolean;
  scoringPositions?: number;
  minPart1ToScore?: number;
}

interface QualifyingRecord {
  key: string;
  stage: Stage;
  bird: Bird;
  stakeNumber: string;
  position: number;
  points: number;
  part1Songs: number;
  part2Songs: number;
}

function normalizeUploadedLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Arquivo vazio.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem não suportado.'));
      img.onload = () => {
        const maxW = 800;
        const maxH = 400;
        const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function CertificateGeneratorCard({
  championshipName,
  seasonYear,
  modality,
  stages,
  birds,
  entries,
  eventLogoDataUrl,
  onUpdateEventLogo,
  readOnly = false,
  scoringPositions = 30,
  minPart1ToScore = 1,
}: CertificateGeneratorCardProps) {
  const certificatePositionsLimit = modality
    ? Math.min(getModalityTopLimit(modality), scoringPositions)
    : scoringPositions;
  const isTimeModality = isTimeScoredModality(modality);

  const [maxPosition, setMaxPosition] = useState<number>(certificatePositionsLimit);
  const [stageFilterId, setStageFilterId] = useState<string>('all');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [exportingType, setExportingType] = useState<'png' | 'pdf' | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string>(PRESIDENT_SIGNATURE_PATH);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMaxPosition(certificatePositionsLimit);
  }, [certificatePositionsLimit]);

  const cornerOrnamentUrl = useMemo(() => buildBotanicalCornerDataUrl(), []);
  const watermarkUrl = useMemo(() => buildCertificateWatermarkDataUrl(), []);
  const customWatermarkRawUrl = getCertificateCustomWatermarkUrl(modality);
  const [customWatermarkUrl, setCustomWatermarkUrl] = useState<string | null>(
    customWatermarkRawUrl
  );

  useEffect(() => {
    let active = true;
    void loadTrimmedPresidentSignature().then((res) => {
      if (active && res?.dataUrl) {
        setSignatureUrl(res.dataUrl);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!customWatermarkRawUrl) {
      setCustomWatermarkUrl(null);
      return;
    }
    setCustomWatermarkUrl(customWatermarkRawUrl);
    let active = true;
    void loadImageElement(customWatermarkRawUrl).then((img) => {
      if (!active || !img || img.naturalWidth === 0) return;
      const trimmed = trimTransparentImageCanvas(img);
      if (trimmed instanceof HTMLCanvasElement) {
        try {
          setCustomWatermarkUrl(trimmed.toDataURL('image/png'));
        } catch {
          // keep original URL fallback
        }
      }
    });
    return () => {
      active = false;
    };
  }, [customWatermarkRawUrl]);

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.stageNumber - b.stageNumber),
    [stages]
  );

  const clampedMaxPosition = useMemo(() => {
    const val = Math.floor(Number(maxPosition));
    if (!Number.isFinite(val)) return certificatePositionsLimit;
    return Math.max(1, Math.min(certificatePositionsLimit, val));
  }, [maxPosition, certificatePositionsLimit]);

  const qualifyingRecords: QualifyingRecord[] = useMemo(() => {
    const targetStages =
      stageFilterId === 'all'
        ? orderedStages
        : orderedStages.filter((s) => s.id === stageFilterId);

    const list: QualifyingRecord[] = [];
    for (const stage of targetStages) {
      const ranked = computeStageRanking(stage, entries, birds, {
        scoringPositions,
        minPart1ToScore,
      });
      for (const row of ranked) {
        if (row.entry.part1Songs < minPart1ToScore) continue;
        if (row.position >= 1 && row.position <= clampedMaxPosition) {
          list.push({
            key: `${stage.id}::${row.bird.id}`,
            stage,
            bird: row.bird,
            stakeNumber: row.entry.stakeNumber,
            position: row.position,
            points: row.points,
            part1Songs: row.entry.part1Songs,
            part2Songs: row.entry.part2Songs,
          });
        }
      }
    }

    return list.sort((a, b) => {
      if (a.stage.stageNumber !== b.stage.stageNumber) {
        return b.stage.stageNumber - a.stage.stageNumber;
      }
      return a.position - b.position;
    });
  }, [
    orderedStages,
    stageFilterId,
    entries,
    birds,
    clampedMaxPosition,
    scoringPositions,
    minPart1ToScore,
  ]);

  useEffect(() => {
    if (qualifyingRecords.length === 0) {
      if (selectedKey !== '') setSelectedKey('');
      return;
    }
    if (!qualifyingRecords.some((r) => r.key === selectedKey)) {
      setSelectedKey(qualifyingRecords[0].key);
    }
  }, [qualifyingRecords, selectedKey]);

  const activeRecord = useMemo(
    () => qualifyingRecords.find((r) => r.key === selectedKey) ?? null,
    [qualifyingRecords, selectedKey]
  );

  const previewIssuedAtText = useMemo(() => {
    const now = new Date();
    return `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }, [selectedKey]);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || !onUpdateEventLogo) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);
    try {
      const normalized = await normalizeUploadedLogo(file);
      onUpdateEventLogo(normalized);
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : 'Não foi possível carregar a logomarca.'
      );
    }
  };

  const buildCertificateData = (rec: QualifyingRecord): CertificateData => {
    const now = new Date();
    const issuedAtText = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    return {
      championshipName,
      seasonYear,
      modality,
      birdName: rec.bird.name,
      ownerName: rec.bird.ownerName,
      isMember: rec.bird.isMember,
      stageNumber: rec.stage.stageNumber,
      stageName: rec.stage.name,
      stageDateText: formatDatePtBr(rec.stage.date),
      stageAddress: rec.stage.address,
      stakeNumber: rec.stakeNumber,
      position: rec.position,
      points: rec.points,
      part1Songs: rec.part1Songs,
      part2Songs: rec.part2Songs,
      issuedAtText,
      eventLogoDataUrl,
    };
  };

  const handleDownloadPng = async (rec: QualifyingRecord) => {
    setExportingType('png');
    try {
      await exportCertificateToPng(buildCertificateData(rec));
    } finally {
      setExportingType(null);
    }
  };

  const handleDownloadPdf = async (rec: QualifyingRecord) => {
    setExportingType('pdf');
    try {
      await exportCertificateToPdf(buildCertificateData(rec));
    } finally {
      setExportingType(null);
    }
  };

  if (stages.length === 0 || birds.length === 0) {
    return null;
  }

  return (
    <section
      id="certificados-section"
      aria-label="Gerador de certificados de participação"
      className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3 print:hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Award className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
              Certificados dos {certificatePositionsLimit} Primeiros Colocados
            </h2>
            <p className="text-xs text-slate-500">
              Disponível para os {certificatePositionsLimit} primeiros colocados de cada etapa. Selecione a etapa e a ave para baixar em PNG ou PDF.
            </p>
          </div>
        </div>

        <span className="font-mono tabular-nums text-xs font-semibold text-emerald-800 shrink-0">
          {qualifyingRecords.length}{' '}
          {qualifyingRecords.length === 1 ? 'certificado disponível' : 'certificados disponíveis'}
        </span>
      </div>

      {/* Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:p-3">
        <div className="sm:col-span-2">
          <label
            htmlFor="cert-max-position"
            className="block text-[11px] font-semibold text-slate-600 mb-1"
          >
            Até Posição (1º–{certificatePositionsLimit}º)
          </label>
          <input
            id="cert-max-position"
            type="number"
            min={1}
            max={certificatePositionsLimit}
            inputMode="numeric"
            value={maxPosition}
            onChange={(e) => setMaxPosition(Number(e.target.value))}
            className="w-full min-h-[38px] px-2.5 text-center font-mono tabular-nums text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>

        <div className="sm:col-span-3">
          <label
            htmlFor="cert-stage-filter"
            className="block text-[11px] font-semibold text-slate-600 mb-1"
          >
            Etapa
          </label>
          <select
            id="cert-stage-filter"
            value={stageFilterId}
            onChange={(e) => setStageFilterId(e.target.value)}
            className="w-full min-h-[38px] px-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer"
          >
            <option value="all">Qualquer etapa</option>
            {orderedStages.map((s) => (
              <option key={s.id} value={s.id}>
                Etapa {String(s.stageNumber).padStart(2, '0')} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-4">
          <label
            htmlFor="cert-record-select"
            className="block text-[11px] font-semibold text-slate-600 mb-1"
          >
            Ave e Etapa Classificada
          </label>
          <select
            id="cert-record-select"
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            disabled={qualifyingRecords.length === 0}
            className="w-full min-h-[38px] px-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {qualifyingRecords.length === 0 ? (
              <option value="">Nenhuma ave entre os {clampedMaxPosition} primeiros</option>
            ) : (
              qualifyingRecords.map((rec) => (
                <option key={rec.key} value={rec.key}>
                  {rec.position}º Lugar · {rec.bird.name} · E{String(rec.stage.stageNumber).padStart(2, '0')} ({rec.points} pts)
                </option>
              ))
            )}
          </select>
        </div>

        {!readOnly && onUpdateEventLogo && (
          <div className="sm:col-span-3 flex items-center gap-1.5">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleLogoFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="flex-1 min-h-[38px] px-2.5 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>{eventLogoDataUrl ? 'Trocar Logo' : 'Logo Evento'}</span>
            </button>

            {eventLogoDataUrl ? (
              <button
                type="button"
                onClick={() => {
                  onUpdateEventLogo(undefined);
                  setLogoError(null);
                }}
                aria-label="Remover logomarca do evento"
                title="Remover logomarca"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-red-600 bg-white border border-slate-200 hover:bg-red-50 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onUpdateEventLogo(DEFAULT_EVENT_LOGO_URL);
                  setLogoError(null);
                }}
                aria-label="Restaurar logotipo padrão AOPE"
                title="Usar logotipo padrão AOPE"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-emerald-700 bg-white border border-slate-200 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {logoError && (
        <p className="text-xs font-medium text-red-700">{logoError}</p>
      )}

      {/* Empty State or Live Certificate Preview + Download Buttons */}
      {!activeRecord ? (
        <div className="bg-slate-50/70 border border-dashed border-slate-300 rounded-xl p-5 text-center text-xs sm:text-sm text-slate-600">
          Nenhuma ave classificada entre os{' '}
          <strong className="font-mono tabular-nums text-slate-900">
            {clampedMaxPosition} primeiros colocados
          </strong>{' '}
          {stageFilterId === 'all' ? 'em alguma etapa pontuada' : 'nesta etapa'} (
          {isTimeModality
            ? 'é necessário ter tempo registrado nos 10 min'
            : 'é necessário ter cantos registrados nos 10 min'}
          ).
        </div>
      ) : (
        <div className="space-y-3">
          {/* Formal Classic Parchment Certificate Template Preview */}
          <div className="relative overflow-hidden rounded-2xl p-2 sm:p-3 bg-[radial-gradient(circle_at_50%_45%,#fdfaf2_0%,#f8f3e4_68%,#efe6cf_100%)] border-[2px] border-[#b8860b] shadow-sm">
            {/* Evident centered watermark illustration */}
            <img
              src={
                customWatermarkRawUrl
                  ? customWatermarkUrl ?? customWatermarkRawUrl
                  : watermarkUrl
              }
              alt=""
              aria-hidden="true"
              className={
                customWatermarkRawUrl
                  ? 'pointer-events-none select-none absolute inset-0 m-auto w-[64%] max-w-[460px] max-h-[82%] object-contain opacity-[0.78]'
                  : 'pointer-events-none select-none absolute inset-0 m-auto w-[78%] max-w-[500px] object-contain opacity-100'
              }
            />

            {/* Four Botanical Corner Ornaments (Forest Green & Aged Gold) */}
            <img
              src={cornerOrnamentUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none absolute top-1 left-1 w-16 h-16 sm:w-24 sm:h-24"
            />
            <img
              src={cornerOrnamentUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none absolute top-1 right-1 w-16 h-16 sm:w-24 sm:h-24 -scale-x-100"
            />
            <img
              src={cornerOrnamentUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none absolute bottom-1 left-1 w-16 h-16 sm:w-24 sm:h-24 -scale-y-100"
            />
            <img
              src={cornerOrnamentUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none select-none absolute bottom-1 right-1 w-16 h-16 sm:w-24 sm:h-24 -scale-x-100 -scale-y-100"
            />

            <div className="relative z-10 border border-[#d4af37] rounded-xl px-4 pt-6 pb-3 sm:px-10 sm:pt-7 sm:pb-4 text-center space-y-2.5">
              {/* Top-Center Event Logo */}
              <div className="flex justify-center">
                {eventLogoDataUrl ? (
                  <div className="h-20 sm:h-28 flex items-center justify-center bg-transparent">
                    <img
                      src={eventLogoDataUrl}
                      alt="Logomarca do evento"
                      className="max-h-full max-w-[260px] object-contain bg-transparent"
                    />
                  </div>
                ) : !readOnly ? (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="h-20 sm:h-28 px-6 border border-dashed border-[#c59b27]/60 bg-transparent hover:bg-[#fdfaf2]/50 rounded-xl inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Logomarca do Evento</span>
                  </button>
                ) : null}
              </div>

              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.12em] text-[#1b4332]">
                {championshipName} · Temporada {seasonYear}
              </p>

              <div className="space-y-1.5">
                <h3
                  style={{ fontFamily: 'Tahoma, Verdana, Geneva, sans-serif' }}
                  className="text-xl sm:text-3xl font-bold tracking-wide text-[#14452f] drop-shadow-[0_1px_0_rgba(212,175,55,0.45)]"
                >
                  CERTIFICADO DE PARTICIPAÇÃO
                </h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="w-14 sm:w-20 h-[1.5px] bg-gradient-to-r from-transparent to-[#c59b27]" />
                  <span className="w-2 h-2 rotate-45 bg-[#c59b27]" />
                  <span className="w-14 sm:w-20 h-[1.5px] bg-gradient-to-l from-transparent to-[#c59b27]" />
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 italic pt-0.5">
                Certificamos oficialmente que a ave competidora
              </p>

              <div className="space-y-0.5">
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14452f]">
                  {activeRecord.bird.name}
                </p>
                <p className="text-xs sm:text-sm font-semibold text-slate-800">
                  Proprietário: {activeRecord.bird.ownerName}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 max-w-2xl mx-auto">
                participou da{' '}
                <strong className="text-slate-900">
                  Etapa {String(activeRecord.stage.stageNumber).padStart(2, '0')}{' '}
                  {activeRecord.stage.name}
                </strong>
                .
              </p>

              {/* Centered Cream/Ivory Semitransparent Metrics Card with Soft Shadow */}
              <div className="bg-[#fdfaf1]/78 border border-[#d4af37]/50 rounded-2xl p-3.5 sm:p-4 shadow-[0_6px_20px_-6px_rgba(20,69,47,0.12)] max-w-2xl mx-auto space-y-2.5">
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    Etapa {String(activeRecord.stage.stageNumber).padStart(2, '0')} (
                    {formatDatePtBr(activeRecord.stage.date)})
                    {activeRecord.stakeNumber
                      ? ` · Estaca ${activeRecord.stakeNumber}`
                      : ''}
                  </p>
                  {activeRecord.stage.address && (
                    <p className="text-[11px] sm:text-xs text-slate-600">
                      {activeRecord.stage.address}
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-[#d4af37]/30 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Colocação
                    </p>
                    <p className="font-mono tabular-nums text-sm sm:text-base font-bold text-slate-900">
                      {activeRecord.position}º Lugar
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Pontuação
                    </p>
                    <p className="font-mono tabular-nums text-sm sm:text-base font-bold text-emerald-700">
                      {activeRecord.points} pts
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {isTimeModality ? 'Tempo 10 min' : 'Cantos 10 min'}
                    </p>
                    <p className="font-mono tabular-nums text-sm sm:text-base font-bold text-slate-900">
                      {formatScoreValue(activeRecord.part1Songs, modality)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {isTimeModality ? 'Tempo 15 min' : 'Cantos 15 min'}
                    </p>
                    <p className="font-mono tabular-nums text-sm sm:text-base font-bold text-sky-700">
                      {formatScoreValue(activeRecord.part2Songs, modality)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Signature & Official Footer (Lowered, Without Top Line) */}
              <div className="pt-3 sm:pt-4 flex flex-col items-center">
                <img
                  src={signatureUrl}
                  alt="Assinatura Presidente AOPE"
                  className="pointer-events-none select-none h-11 sm:h-14 w-auto object-contain -mb-1"
                />
                <p className="text-xs sm:text-sm font-bold text-slate-900">Presidente AOPE</p>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                  Emitido em {previewIssuedAtText} · Canto &amp; Fibra · Documento Oficial
                </p>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
            <p className="text-xs text-slate-500">
              Modelo pronto para envio digital (PNG) ou impressão paisagem (PDF A4).
            </p>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => void handleDownloadPng(activeRecord)}
                className="flex-1 sm:flex-none min-h-[38px] px-3 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <ImageDown className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {exportingType === 'png' ? 'Gerando...' : 'Baixar Imagem (PNG)'}
                </span>
              </button>

              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => void handleDownloadPdf(activeRecord)}
                className="flex-1 sm:flex-none min-h-[38px] px-3.5 py-1.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{exportingType === 'pdf' ? 'Gerando...' : 'Baixar PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
