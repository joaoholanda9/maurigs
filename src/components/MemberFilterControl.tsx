import type { MemberFilter } from '../types/championship';

interface MemberFilterControlProps {
  value: MemberFilter;
  onChange: (value: MemberFilter) => void;
  counts?: {
    all: number;
    members: number;
    nonMembers: number;
  };
}

export function MemberFilterControl({
  value,
  onChange,
  counts,
}: MemberFilterControlProps) {
  const options: { id: MemberFilter; label: string; count?: number }[] = [
    { id: 'all', label: 'Todos', count: counts?.all },
    { id: 'members', label: 'Apenas Sócios', count: counts?.members },
    { id: 'non_members', label: 'Não Sócios', count: counts?.nonMembers },
  ];

  return (
    <div
      role="group"
      aria-label="Filtrar por vínculo de sócio"
      className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`min-h-[38px] px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span className="ml-1.5 font-mono tabular-nums text-xs text-slate-500">
                ({opt.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
