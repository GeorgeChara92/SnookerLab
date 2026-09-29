import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router";
import { MotionConfig } from "motion/react";
import { Footer, Header, ScrollToTop } from "./components/Chrome";
import { TableSprite } from "./components/Table";
import Home from "./pages/Home";
import { Community, Practice, Scoring } from "./pages/Features";
import Coach from "./pages/Coach";
import FindACoach from "./pages/FindACoach";
import ScanSnooker from "./pages/ScanSnooker";
import AdminDashboard from "./pages/AdminDashboard";
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

/** Shows each .rv block as it arrives. Without an observer, or with reduced motion, everything shows at once. */
function useReveals() {
  const { pathname } = useLocation();
  useEffect(() => {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(".rv:not(.in)"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      blocks.forEach((block) => block.classList.add("in"));
      return;
    }
    const show = (block: HTMLElement) => {
      block.classList.add("in");
      seen.unobserve(block);
    };
    const seen = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && show(entry.target as HTMLElement)),
      { rootMargin: "0px 0px -8% 0px" }
    );
    blocks.forEach((block) => seen.observe(block));

    // A fast scroll can outrun the observer, so anything already past the fold is shown anyway.
    let queued = false;
    const sweep = () => {
      queued = false;
      blocks.forEach((block) => {
        if (!block.classList.contains("in") && block.getBoundingClientRect().top < window.innerHeight) show(block);
      });
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sweep);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      seen.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);
}

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
  useReveals();
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <ScrollToTop />
      <Meta />
      <TableSprite />
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scoring" element={<Scoring />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/find-a-coach" element={<FindACoach />} />
          <Route path="/scan-snooker" element={<ScanSnooker />} />
          <Route path="/community" element={<Community />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/support" element={<Support />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </MotionConfig>
  );
}
