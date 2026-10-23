/** Enganche para abrir enlaces a otros documentos del proyecto (PRJ-29) desde el editor. */
export const linkHooks: {
  /** Devuelve true si el enlace era un documento del proyecto y ya se abrió. */
  open?: (href: string) => boolean;
} = {};
