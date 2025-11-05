import { createRoot } from 'react-dom/client';
import Options from '@pages/options/Options';
import '@pages/options/index.css';
import { ThemeProvider } from "@/components/theme-provider";

function init() {
  const rootContainer = document.querySelector("#__fix-this-shadow");
  if (!rootContainer) throw new Error("Can't find Options root element");
  const root = createRoot(rootContainer);
  root.render(
    <ThemeProvider>
      <Options />
    </ThemeProvider>
  );
}

init();
