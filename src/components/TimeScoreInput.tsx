import { forwardRef, useEffect, useState } from 'react';
import { formatTenthsAsTime, parseTimeTenths } from '../utils/scoring';

interface TimeScoreInputProps {
  id?: string;
  value: number;
  ariaLabel: string;
  className: string;
  disabled?: boolean;
  onChangeValue: (nextTenths: number) => void;
  onEnterNext?: () => void;
}

export const TimeScoreInput = forwardRef<HTMLInputElement, TimeScoreInputProps>(
  function TimeScoreInput(
    {
      id,
      value,
      ariaLabel,
      className,
      disabled = false,
      onChangeValue,
      onEnterNext,
    },
    ref
  ) {
    const [draft, setDraft] = useState(() => formatTenthsAsTime(value));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (!isFocused) {
        setDraft(formatTenthsAsTime(value));
      }
    }, [value, isFocused]);

    const commitBlur = () => {
      setIsFocused(false);
      const parsed = parseTimeTenths(draft);
      if (parsed === null) {
        setDraft(formatTenthsAsTime(value));
        return;
      }
      const clean = Math.max(0, parsed);
      setDraft(formatTenthsAsTime(clean));
      if (!disabled && clean !== value) {
        onChangeValue(clean);
      }
    };

    return (
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        placeholder="0:00.0"
        aria-label={ariaLabel}
        value={draft}
        disabled={disabled}
        onFocus={(e) => {
          if (disabled) return;
          setIsFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          if (disabled) return;
          const raw = e.target.value;
          setDraft(raw);
          if (raw.trim() === '') {
            onChangeValue(0);
            return;
          }
          const parsed = parseTimeTenths(raw);
          if (parsed !== null) {
            onChangeValue(Math.max(0, parsed));
          }
        }}
        onBlur={commitBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const parsed = parseTimeTenths(draft);
            if (parsed !== null) {
              const clean = Math.max(0, parsed);
              setDraft(formatTenthsAsTime(clean));
              onChangeValue(clean);
            }
            if (onEnterNext) {
              onEnterNext();
            } else {
              e.currentTarget.blur();
            }
          }
        }}
        className={className}
      />
    );
  }
);
