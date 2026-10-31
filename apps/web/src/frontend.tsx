import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { RpcProvider } from "./components/RpcProvider";
import "./styles.css";

const element = document.getElementById("root");
if (!element) {
  throw new Error("The page is missing its #root element.");
}

const app = (
  <StrictMode>
    <RpcProvider>
      <App path={element.dataset.pagePath ?? window.location.pathname} />
    </RpcProvider>
  </StrictMode>
);

// Production HTML is pre-rendered; development keeps Bun's React hot reload.
if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(element));
  root.render(app);
} else if (element.hasChildNodes()) {
  hydrateRoot(element, app);
} else {
  createRoot(element).render(app);
}
