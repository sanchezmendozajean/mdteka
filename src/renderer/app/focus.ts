import { useUi } from './store';

/** Modo concentración (`F11`): solo el documento, a pantalla completa. `Esc` o `F11` lo cierran. */
export function setFocusMode(on: boolean): void {
  if (useUi.getState().focusMode === on) return;
  useUi.getState().set({ focusMode: on });
  void window.mdtor.window.setFullScreen(on);
}

export const toggleFocusMode = (): void => setFocusMode(!useUi.getState().focusMode);

export function wireFocus(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && useUi.getState().focusMode) {
      e.preventDefault();
      setFocusMode(false);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
