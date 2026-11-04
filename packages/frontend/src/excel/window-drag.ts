// A mouse drag tracked on the whole window, so it ends cleanly wherever the button comes up: on release, when
// the window loses focus (Alt+Tab), or on a move with the button no longer held (a release we never heard of).
// Only a release we saw counts as 'release'; every other end is a 'cancel'.

export function startWindowDrag(handlers: {
  onMove?: (event: MouseEvent) => void;
  onEnd?: (reason: 'release' | 'cancel') => void;
}): () => void {
  let active = true;

  function end(reason: 'release' | 'cancel') {
    if (!active) return;
    active = false;
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', release);
    window.removeEventListener('blur', cancel);
    handlers.onEnd?.(reason);
  }
  const release = () => end('release');
  const cancel = () => end('cancel');

  function move(event: MouseEvent) {
    if ((event.buttons & 1) === 0) cancel();
    else handlers.onMove?.(event);
  }

  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', release);
  window.addEventListener('blur', cancel);
  return cancel;
}
