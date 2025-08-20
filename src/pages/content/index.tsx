import { ThemeProvider } from "@/components/theme-provider";
import { createRoot } from 'react-dom/client';
import './style.css';
import Uploader from './uploader';
import { observeElement } from "@/lib/utils";
import { PremiumModalProvider } from "@/context/premium-modal";
import { SpeechModeProvider } from "../../context/speech-mode";

const render = (state: boolean) => {
  if (state) return; //return if shadow root is already present

  const div = document.createElement('div');
  div.id = '__gpt-reader-shadow';
  document.body.appendChild(div);

  //resolve over flow issue on firefox/chrome
  const bodyClassName = document.body.className;
  document.body.className = `overflow-hidden ${bodyClassName}`;
  document.body.appendChild(div);

  const rootContainer = document.querySelector('#__gpt-reader-shadow');
  if (!rootContainer) throw new Error("Can't find Content root element");

  const root = createRoot(rootContainer);

  root.render(
    <ThemeProvider>
      <PremiumModalProvider>
        <SpeechModeProvider>
          <Uploader />
        </SpeechModeProvider>
      </PremiumModalProvider>
    </ThemeProvider>
  );
}

//observes the shadow root of the extension and renders the component if it is not present
observeElement("div#__gpt-reader-shadow", render);

// ensure an immediate first‐pass render
render(false);

// polling fallback (tries every 500ms until it sees your container)
const __gptReaderPoll = setInterval(() => {
  if (!document.querySelector('#__gpt-reader-shadow')) {
    render(false);
  } else {
    clearInterval(__gptReaderPoll);
  }
}, 500);