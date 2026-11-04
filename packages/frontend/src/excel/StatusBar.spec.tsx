import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBar } from './StatusBar';

const texts = () => Array.from(screen.getByRole('status').querySelectorAll('span'), (s) => s.textContent);

describe('StatusBar', () => {
  it('shows the selection summary instead of the row count', () => {
    render(<StatusBar status="Ready" count={480} selection={{ count: 3, sum: 880362, average: 293454 }} />);
    const shown = texts();
    const at = (text: string) => shown.indexOf(text);
    expect(at('Average: 293,454')).toBeGreaterThan(-1);
    expect(at('Count: 3')).toBeGreaterThan(at('Average: 293,454'));
    expect(at('Sum: 880,362')).toBeGreaterThan(at('Count: 3'));
    expect(screen.queryByText('Count: 480')).not.toBeInTheDocument();
  });

  it('count only for text', () => {
    render(<StatusBar status="Ready" count={480} selection={{ count: 2 }} />);
    expect(screen.getByText('Count: 2')).toBeInTheDocument();
    expect(screen.queryByText(/Average:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sum:/)).not.toBeInTheDocument();
  });

  it('no selection keeps the row count', () => {
    render(<StatusBar status="Ready" count={480} />);
    expect(screen.getByText('Count: 480')).toBeInTheDocument();
  });
});
