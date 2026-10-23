/** CSP estricta. En desarrollo se permite el servidor de Vite (HMR). */
export function buildCsp(dev: boolean): string {
  const connect = dev ? "'self' ws://localhost:* http://localhost:*" : "'self'";
  const script = dev ? "'self' 'unsafe-inline'" : "'self'";
  return [
    "default-src 'none'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: mdteca-asset: https:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
