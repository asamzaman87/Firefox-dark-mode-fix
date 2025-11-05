import React from 'react';
import { createRoot } from 'react-dom/client';
import Newtab from '@pages/newtab/Newtab';
import '@pages/newtab/index.css';
import '@assets/styles/tailwind.css';
import { ThemeProvider } from "@/components/theme-provider";

function init() {
  const rootContainer = document.querySelector("#__fix-this-shadow");
  if (!rootContainer) throw new Error("Can't find Newtab root element");
  const root = createRoot(rootContainer);
  root.render(
    <ThemeProvider>
      <Newtab />
    </ThemeProvider>
  );
}

init();
