import '@assets/styles/tailwind.css';
import '@pages/popup/index.css';
import Popup from '@pages/popup/Popup';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from "@/components/theme-provider";

function init() {
  const rootContainer = document.querySelector("#__fix-this-shadow");
  if (!rootContainer) throw new Error("Can't find Popup root element");
  const root = createRoot(rootContainer);
  root.render(
    <ThemeProvider>
      <Popup />
    </ThemeProvider>
  );
}

init();
