import './fonts';
import './styles/tokens.css';
import './styles/app.css';
import './styles/editor.css';
import './i18n';
import './commands/builtin';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

// ED-10: las fuentes se cargan antes del primer pintado para evitar re-layout.
void document.fonts.ready.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
