import { describe, expect, it } from 'vitest';
import { buildCsp } from '../../src/main/csp';
import { isSafeExternalUrl } from '../../src/main/security';
import { ipcContract } from '@shared/ipc';

describe('seguridad (02)', () => {
  it('[SEC] solo http, https y mailto se abren externamente', () => {
    expect(isSafeExternalUrl('https://mdteca.app')).toBe(true);
    expect(isSafeExternalUrl('mailto:a@b.c')).toBe(true);
    expect(isSafeExternalUrl('file:///C:/Windows/System32/calc.exe')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('no es url')).toBe(false);
  });

  it('[SEC] la CSP de producción no permite scripts inline ni eval', () => {
    const csp = buildCsp(false);
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    expect(csp).toContain("default-src 'none'");
  });

  it('[SEC] los canales IPC validan su respuesta', () => {
    const { response } = ipcContract['app:info'];
    expect(() =>
      response.parse({ name: 'x', version: '1', platform: 'plan9', e2e: false }),
    ).toThrow();
    expect(
      response.parse({ name: 'x', version: '1', platform: 'win32', e2e: false }).platform,
    ).toBe('win32');
  });
});
