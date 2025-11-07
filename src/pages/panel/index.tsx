import React from 'react';
import { createRoot } from 'react-dom/client';
import Panel from '@pages/panel/Panel';
import '@pages/panel/index.css';
import '@assets/styles/tailwind.css';
import { ThemeProvider } from "@/components/theme-provider";

function init() {
  const rootContainer = document.querySelector("#__fix-this-shadow");
  if (!rootContainer) throw new Error("Can't find Panel root element");
  const root = createRoot(rootContainer);
  root.render(
    <ThemeProvider>
      <Panel />
    </ThemeProvider>
  );
}

init();
