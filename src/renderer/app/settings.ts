import { create } from 'zustand';
import { SettingsSchema, type Settings } from '@shared/settings';

/** Ajustes de la app ya validados (09). La fuente de verdad es `userData/settings.json` en main. */
export const useAppSettings = create<{
  settings: Settings;
  loaded: boolean;
  set: (settings: Settings) => void;
}>((set) => ({
  settings: SettingsSchema.parse({}),
  loaded: false,
  set: (settings) => set({ settings, loaded: true }),
}));

export const appSettings = (): Settings => useAppSettings.getState().settings;

/** Aplica un parche a los ajustes: main lo valida y lo guarda, y el renderer lo adopta. */
export async function updateAppSettings(patch: Record<string, unknown>): Promise<Settings> {
  const next = await window.mdtor.settings.set(patch);
  useAppSettings.getState().set(next);
  return next;
}

export async function resetAppSettings(): Promise<Settings> {
  const next = await window.mdtor.settings.reset();
  useAppSettings.getState().set(next);
  return next;
}
