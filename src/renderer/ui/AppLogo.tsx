/** Logotipo de la app (`specs/design/icono.svg`): libro abierto verde sobre fondo oscuro. */
export function AppLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M85.53,100H14.47C6.48,100,0,93.52,0,85.53V14.47C0,6.48,6.48,0,14.47,0h71.06C93.52,0,100,6.48,100,14.47v71.06C100,93.52,93.52,100,85.53,100z" />
      <path
        fill="#6FB857"
        d="M52.5,21.63v59.01c4.53-2.22,9.71-3.42,15-3.42s10.47,1.2,15,3.42V21.63c-4.3-2.67-9.58-4.13-15-4.13S56.8,18.96,52.5,21.63z"
      />
      <path
        fill="#6FB857"
        d="M17.5,21.63v59.01c4.53-2.22,9.71-3.42,15-3.42s10.47,1.2,15,3.42V21.63c-4.3-2.67-9.58-4.13-15-4.13S21.8,18.96,17.5,21.63z"
      />
    </svg>
  );
}
