import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { readConfig } from "./widget-config";
import { WidgetApp } from "./WidgetApp";
import "./widget.css";

const element = document.getElementById("root");
const config = readConfig();
if (element && config) {
  document.documentElement.dataset.theme = config.theme;
  createRoot(element).render(
    <StrictMode>
      <WidgetApp config={config} />
    </StrictMode>,
  );
} else if (element) {
  element.textContent = "This BotRepel widget is misconfigured.";
}
