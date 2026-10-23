/** Enlace entre los editores (pegar y soltar imágenes) y el flujo de `documents/images.ts`. */
export const imageHooks: { onFiles: ((files: File[], pos: number | null) => void) | null } = {
  onFiles: null,
};

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

/** Archivos de imagen de una lista de pegado o de arrastre. */
export function imageFilesFrom(list: FileList | null | undefined): File[] {
  return [...(list ?? [])].filter((f) => f.type.startsWith('image/') || IMAGE_NAME.test(f.name));
}
