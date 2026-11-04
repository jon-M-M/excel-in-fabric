import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGate, EMBEDDED_SIGN_IN_GRACE_MS } from './auth-gate.component';

const auth = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const embedded = vi.hoisted(() => ({ current: false }));

vi.mock('@/hooks/auth.context', () => ({ useAuth: () => auth.current }));
vi.mock('@/excel/embedded', () => ({ isFabricEmbedded: () => embedded.current }));

function signedOut(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    isAuthenticated: false,
    canSignIn: true,
    signIn: vi.fn(),
    isSigningIn: false,
    signInError: undefined,
    config: { kind: 'ready' },
    error: undefined,
    ...overrides,
  };
}

const renderGate = () =>
  render(
    <AuthGate>
      <p>the app</p>
    </AuthGate>
  );

describe('AuthGate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    embedded.current = false;
  });

  it('shows the splash while loading', () => {
    auth.current = signedOut({ isLoading: true });
    renderGate();
    expect(screen.getByRole('status', { name: 'Starting Excel in Fabric' })).toBeInTheDocument();
  });

  it('shows the splash when embedded and not yet signed in', () => {
    embedded.current = true;
    auth.current = signedOut();
    renderGate();
    expect(screen.getByRole('status', { name: 'Starting Excel in Fabric' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in with Microsoft' })).not.toBeInTheDocument();
  });

  it('shows the sign-in card after the grace period', () => {
    embedded.current = true;
    auth.current = signedOut();
    renderGate();
    act(() => vi.advanceTimersByTime(EMBEDDED_SIGN_IN_GRACE_MS));
    expect(screen.getByRole('button', { name: 'Sign in with Microsoft' })).toBeInTheDocument();
  });

  it('shows the sign-in card at once when not embedded', () => {
    auth.current = signedOut();
    renderGate();
    expect(screen.getByRole('button', { name: 'Sign in with Microsoft' })).toBeInTheDocument();
  });

  it('shows the app once signed in', () => {
    embedded.current = true;
    auth.current = signedOut({ isAuthenticated: true });
    renderGate();
    expect(screen.getByText('the app')).toBeInTheDocument();
  });
});
