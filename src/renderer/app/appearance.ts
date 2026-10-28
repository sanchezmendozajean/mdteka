import i18next from 'i18next';
import { setShortcutOverrides } from '../commands/registry';
import { appSettings, updateAppSettings, useAppSettings } from './settings';
import { useUi } from './store';

/**
 * Aplica los ajustes de apariencia a la interfaz: tema (con «seguir al sistema»), acento, densidad,
 * hoja en tema oscuro, escala, idioma y corrector. Se llama una vez al arrancar.
 */
export function wireAppearance(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let lastSpell = '';

  const apply = () => {
    const { appearance, general, editor, shortcuts } = appSettings();
    setShortcutOverrides(shortcuts);
    const effective =
      appearance.theme === 'system' ? (media.matches ? 'dark' : 'light') : appearance.theme;
    if (useUi.getState().theme !== effective) useUi.getState().set({ theme: effective });
    const root = document.documentElement;
    root.dataset['accent'] = appearance.accent;
    root.dataset['density'] = appearance.density;
    root.dataset['sheet'] = appearance.lightSheetInDark ? 'light' : 'dark';
    window.mdtor.appUi.setScale(appearance.uiScale);
    if (i18next.language !== general.language) void i18next.changeLanguage(general.language);
    root.lang = general.language;
    const spell = JSON.stringify([editor.spellcheck, editor.spellLanguages]);
    if (spell !== lastSpell) {
      lastSpell = spell;
      void window.mdtor.spell.configure(editor.spellcheck, editor.spellLanguages);
    }
  };

  apply();
  const off = useAppSettings.subscribe(apply);
  media.addEventListener('change', apply);
  return () => {
    off();
    media.removeEventListener('change', apply);
  };
}

/** Alterna entre claro y oscuro partiendo del tema que se ve ahora (comando «Cambiar tema»). */
export function toggleTheme(): void {
  const next = useUi.getState().theme === 'light' ? 'dark' : 'light';
  void updateAppSettings({ appearance: { theme: next } });
}
