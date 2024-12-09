import { ThemeProvider } from "@/components/theme-provider";
import { createRoot } from 'react-dom/client';
import './style.css';
import Uploader from './uploader';
import { observeForGptReaderShadow } from "@/lib/utils";

const render = ()=>{
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
      <Uploader />
    </ThemeProvider>
  );
}

//observes the shadow root of the extension and renders the component if it is not present
observeForGptReaderShadow("div#__gpt-reader-shadow", render);
