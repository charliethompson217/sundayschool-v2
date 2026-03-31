// src/main.tsx

import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { Providers } from './providers.tsx';

createRoot(document.getElementById('root')!).render(
  <Providers>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Providers>,
);
