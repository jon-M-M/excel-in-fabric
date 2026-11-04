import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startWindowDrag } from './window-drag';

let end: (() => void) | undefined;

function start() {
  const onMove = vi.fn();
  const onEnd = vi.fn();
  end = startWindowDrag({ onMove, onEnd });
  return { onMove, onEnd };
}

afterEach(() => end?.());

describe('startWindowDrag', () => {
  it('calls onMove while the button is held', () => {
    const { onMove } = start();
    fireEvent.mouseMove(window, { buttons: 1, clientX: 10 });
    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove.mock.calls[0][0].clientX).toBe(10);
  });

  it('ends on mouseup', () => {
    const { onMove, onEnd } = start();
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { buttons: 1 });
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledWith('release');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('ends on window blur', () => {
    const { onEnd } = start();
    fireEvent.blur(window);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledWith('cancel');
  });

  it('a move with no button held ends without moving', () => {
    const { onMove, onEnd } = start();
    fireEvent.mouseMove(window, { buttons: 0 });
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledWith('cancel');
  });

  it('the returned function ends it once', () => {
    const { onMove, onEnd } = start();
    end?.();
    end?.();
    fireEvent.mouseMove(window, { buttons: 1 });
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledWith('cancel');
    expect(onMove).not.toHaveBeenCalled();
  });
});
