import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router";
import { MotionConfig } from "motion/react";
import { Footer, Header, ScrollToTop } from "./components/Chrome";
import Home from "./pages/Home";
import { Community, Practice, Scoring } from "./pages/Features";
import ScanSnooker from "./pages/ScanSnooker";
import { NotFound, Plans, Privacy, Support, Terms } from "./pages/Info";
import { metaFor } from "./site";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/geist";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/sections.css";
import "./styles/features.css";

/** Keeps the tab title and description right as the visitor moves between pages. */
function Meta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metaFor(pathname);
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <ScrollToTop />
      <Meta />
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scoring" element={<Scoring />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/scan-snooker" element={<ScanSnooker />} />
          <Route path="/community" element={<Community />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/support" element={<Support />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </MotionConfig>
  );
}
