import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";

document.documentElement.classList.add("js");

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// Pages arrive pre-rendered from the build; in development there is nothing to hydrate.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
