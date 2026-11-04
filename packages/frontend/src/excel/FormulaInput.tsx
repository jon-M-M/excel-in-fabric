// The text box behind both the in-cell editor and the formula bar. While a formula is typed, its references are
// shown in colour: a coloured copy of the text sits behind the input, whose own text is transparent, so typing,
// the caret and selection stay those of a plain input.

import { useLayoutEffect, useRef, type ChangeEvent, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';

import { isFormula } from '@/sheet/formula';
import { findReferences, referenceColors } from '@/sheet/references';

import { referenceColor } from './reference-colors';

interface Props {
  value: string;
  // Where to put the caret after the value changes from outside, e.g. after clicking a cell into a formula.
  caret?: number;
  className?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

function colouredText(formula: string): ReactNode[] {
  const refs = findReferences(formula);
  const colours = referenceColors(refs);
  const parts: ReactNode[] = [];
  let at = 0;
  refs.forEach((ref, i) => {
    parts.push(formula.slice(at, ref.start));
    parts.push(
      <span key={ref.start} data-testid="ref-text" style={{ color: referenceColor(colours[i]) }}>
        {formula.slice(ref.start, ref.end)}
      </span>
    );
    at = ref.end;
  });
  parts.push(formula.slice(at));
  return parts;
}

export function FormulaInput({
  value,
  caret,
  className,
  ariaLabel,
  autoFocus,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const mirrorText = useRef<HTMLSpanElement>(null);
  const coloured = isFormula(value);

  // Keep the coloured copy under the input's text when the input scrolls sideways.
  function syncMirror() {
    if (input.current && mirrorText.current) {
      mirrorText.current.style.transform = `translateX(-${input.current.scrollLeft}px)`;
    }
  }

  useLayoutEffect(() => {
    const element = input.current;
    if (element && caret !== undefined) {
      element.focus({ preventScroll: true });
      element.setSelectionRange(caret, caret);
      // Setting the caret from code doesn't scroll it into view; at the end of the text, show the end.
      if (caret >= value.length) element.scrollLeft = element.scrollWidth;
    }
    syncMirror();
  }, [value, caret]);

  return (
    <span className={`xl-formula-field${coloured ? ' xl-formula-coloured' : ''}${className ? ` ${className}` : ''}`}>
      {coloured && (
        <span className="xl-formula-mirror" aria-hidden="true">
          <span ref={mirrorText}>{colouredText(value)}</span>
        </span>
      )}
      <input
        ref={input}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onKeyUp={syncMirror}
        onSelect={syncMirror}
        onScroll={syncMirror}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </span>
  );
}
