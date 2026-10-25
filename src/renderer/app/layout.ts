import { type Settings } from '@shared/settings';
import { updateAppSettings, useAppSettings } from './settings';
import { useUi } from './store';

/**
 * Disposición recordada (PRJ-20): ancho del navegador y paneles Navegador y Documento visibles.
 * Vive en `settings.json` (`layout`), así que no depende del origen del renderer.
 */
type Layout = Settings['layout'];

const current = (): Layout => {
  const { navigatorWidth, navigatorOpen, documentPanelOpen } = useUi.getState();
  return { navigatorWidth: Math.round(navigatorWidth), navigatorOpen, documentPanelOpen };
};

const same = (a: Layout, b: Layout) =>
  a.navigatorWidth === b.navigatorWidth &&
  a.navigatorOpen === b.navigatorOpen &&
  a.documentPanelOpen === b.documentPanelOpen;

export function wireLayout(): () => void {
  // Ajustes → interfaz: al cargarlos y al restablecer los valores de fábrica.
  const apply = (layout: Layout) => {
    if (!same(layout, current())) useUi.getState().set(layout);
  };
  if (useAppSettings.getState().loaded) apply(useAppSettings.getState().settings.layout);
  const offSettings = useAppSettings.subscribe((s, prev) => {
    if (s.settings.layout !== prev.settings.layout) apply(s.settings.layout);
  });

  // Interfaz → ajustes, con espera para no escribir en cada paso al arrastrar el borde.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const offUi = useUi.subscribe(() => {
    if (!useAppSettings.getState().loaded) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = current();
      if (!same(next, useAppSettings.getState().settings.layout))
        void updateAppSettings({ layout: next }).catch(() => undefined);
    }, 300);
  });

  return () => {
    clearTimeout(timer);
    offSettings();
    offUi();
  };
}
