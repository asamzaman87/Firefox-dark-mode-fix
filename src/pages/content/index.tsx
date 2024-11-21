import { createRoot } from 'react-dom/client';
import Uploader from './uploader';
import './style.css';
import { ThemeProvider } from "@/components/theme-provider"

const div = document.createElement('div');
div.id = '__gpt-reader-shadow';
document.body.appendChild(div);

const rootContainer = document.querySelector('#__gpt-reader-shadow');
if (!rootContainer) throw new Error("Can't find Content root element");

const root = createRoot(rootContainer);

try {
  root.render(
    <ThemeProvider>
      <Uploader />
    </ThemeProvider>
  );
} catch (e) {
  const error = e as Error;
  chrome.runtime.sendMessage({ type: "ERROR", message: error.message });
}

try {
  console.log('content script loaded');
} catch (e) {
  console.error(e);
  const error = e as Error;
  chrome.runtime.sendMessage({ type: "ERROR", message: error.message });
}
