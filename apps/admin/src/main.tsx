import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/geist";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "./styles.css";
import { App } from "./App";

// A second lock: if these files ever ended up on a web server by mistake, the page would show
// nothing but this line rather than a sign-in form.
const local = ["127.0.0.1", "localhost", "[::1]"].includes(window.location.hostname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{local ? <App /> : <p style={{ padding: 24 }}>Not available.</p>}</StrictMode>
);
