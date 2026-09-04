import { useEffect } from "react";
import housingHtml from "../../../public/filament-housing.html?raw";
import fieldHtml from "../../../public/filament.html?raw";
import liveHtml from "../../../public/filament-live.html?raw";

export const FILAMENT_VIEWS = {
  housing: { html: housingHtml, label: "Housing" },
  field: { html: fieldHtml, label: "Field" },
  live: { html: liveHtml, label: "Live" },
} as const;

export type FilamentView = keyof typeof FILAMENT_VIEWS;

const NATIVE_EAR = /getUserMedia|\/live\?|4850/;

function mountExactHtml(host: HTMLElement, html: string): () => void {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const style = parsed.querySelector("style");
  if (style?.textContent) {
    const injected = document.createElement("style");
    injected.textContent = style.textContent.replaceAll("html,body", "#filament-root");
    host.appendChild(injected);
  }

  for (const node of [...parsed.body.childNodes]) {
    if (node instanceof HTMLScriptElement) continue;
    if (node instanceof HTMLElement && (node.id === "listen" || node.id === "as-said")) continue;
    host.appendChild(document.importNode(node, true));
  }

  let raf = 0;
  const origRaf = window.requestAnimationFrame.bind(window);
  const origCancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    raf = origRaf(cb);
    return raf;
  };

  for (const old of parsed.querySelectorAll("script")) {
    const src = old.textContent || "";
    if (NATIVE_EAR.test(src)) continue;
    const script = document.createElement("script");
    script.textContent = src;
    host.appendChild(script);
  }

  return () => {
    origCancel(raf);
    window.requestAnimationFrame = origRaf;
    window.cancelAnimationFrame = origCancel;
    window.filamentCatch = undefined;
    host.replaceChildren();
  };
}

export function FilamentStage({ view = "housing" }: { view?: FilamentView }) {
  useEffect(() => {
    const host = document.createElement("div");
    host.id = "filament-root";
    host.style.cssText =
      "position:fixed;inset:0;z-index:0;overflow:hidden;background:#04060a;pointer-events:none";
    document.body.appendChild(host);
    const stop = mountExactHtml(host, FILAMENT_VIEWS[view].html);
    return () => {
      stop();
      host.remove();
    };
  }, [view]);

  return null;
}
