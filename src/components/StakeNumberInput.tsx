import { useEffect, useState } from 'react';

interface StakeNumberInputProps {
  id?: string;
  value: string;
  onCommit: (nextValue: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export function StakeNumberInput({
  id,
  value,
  onCommit,
  placeholder = '—',
  ariaLabel,
  className = '',
  disabled = false,
}: StakeNumberInputProps) {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value);
    }
  }, [value, isFocused]);

  const commitIfChanged = () => {
    const normalizedDraft = draft.trim().toUpperCase();
    const normalizedValue = value.trim().toUpperCase();
    if (normalizedDraft !== normalizedValue) {
      onCommit(normalizedDraft);
    } else {
      setDraft(value);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={draft}
      onFocus={(e) => {
        setIsFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setIsFocused(false);
        commitIfChanged();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
