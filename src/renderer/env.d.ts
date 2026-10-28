/// <reference types="vite/client" />
import type { MdtorApi } from '@shared/ipc';

declare global {
  interface Window {
    mdtor: MdtorApi;
  }
}
