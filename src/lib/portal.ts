// src/lib/portal.ts
export const getGptrPortalContainer = (): HTMLElement => {
  const id = "gptr-root";
  let el = document.getElementById(id) as HTMLElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    // A light touch: full-screen layer to host portals; actual overlay styling comes from components
    el.style.position = "fixed";
    el.style.inset = "0";
    el.style.zIndex = "2147483647";
    el.style.pointerEvents = "none"; // portals themselves set pointer-events as needed
    document.body.appendChild(el);
  }
  return el;
};