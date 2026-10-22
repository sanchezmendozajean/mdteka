/// <reference types="vite/client" />
import type { MdtecaApi } from '@shared/ipc';

declare global {
  interface Window {
    mdteca: MdtecaApi;
  }
}
