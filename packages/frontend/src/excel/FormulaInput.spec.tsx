import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormulaInput } from './FormulaInput';
import { referenceColor } from './reference-colors';

// jsdom reports colours as rgb(); compare in the same form.
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

describe('FormulaInput', () => {
  it('shows the value and reports changes', () => {
    const onChange = vi.fn();
    render(<FormulaInput value="=A1" ariaLabel="X" onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'X' });
    expect(input).toHaveValue('=A1');
    fireEvent.change(input, { target: { value: '=A2' } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('puts the caret where asked', () => {
    render(<FormulaInput value="=A1+B2" caret={3} ariaLabel="X" onChange={() => {}} />);
    const input = screen.getByRole('textbox', { name: 'X' }) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  });

  it('colours each reference', () => {
    const { container } = render(<FormulaInput value="=A1+SUM(B2:C3)" ariaLabel="X" onChange={() => {}} />);
    const refs = screen.getAllByTestId('ref-text');
    expect(refs.map((r) => r.textContent)).toEqual(['A1', 'B2:C3']);
    expect(refs[0].style.color).toBe(rgb(referenceColor(0)));
    expect(refs[1].style.color).toBe(rgb(referenceColor(1)));
    expect(container.querySelector('.xl-formula-mirror')?.textContent).toBe('=A1+SUM(B2:C3)');
  });

  it('plain text has no mirror', () => {
    const { container } = render(<FormulaInput value="North" ariaLabel="X" onChange={() => {}} />);
    expect(screen.queryByTestId('ref-text')).not.toBeInTheDocument();
    expect(container.querySelector('.xl-formula-mirror')).toBeNull();
  });

  it("the mirror follows the input's horizontal scroll", () => {
    const { container } = render(<FormulaInput value="=A1+B2" ariaLabel="X" onChange={() => {}} />);
    const input = screen.getByRole('textbox', { name: 'X' });
    input.scrollLeft = 40;
    fireEvent.scroll(input);
    const text = container.querySelector('.xl-formula-mirror > span') as HTMLElement;
    expect(text.style.transform).toBe('translateX(-40px)');
  });

  it('brings the end of the text into view when the caret is put at the end', () => {
    const { rerender } = render(<FormulaInput value="=SUM(" ariaLabel="X" onChange={() => {}} />);
    const input = screen.getByRole('textbox', { name: 'X' });
    // jsdom has no layout: say the text is wider than the box.
    Object.defineProperty(input, 'scrollWidth', { configurable: true, value: 119 });
    rerender(<FormulaInput value="=SUM(F2:F10)+F12" caret={16} ariaLabel="X" onChange={() => {}} />);
    expect(input.scrollLeft).toBe(119);
  });
});
