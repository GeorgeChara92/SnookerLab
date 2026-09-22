import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { MORE_NAV, NAV, SUPPORT_EMAIL } from "../site";

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Snookered home">
      <img src="/icon-512.jpg" alt="" width={30} height={30} />
      <span translate="no">Snookered</span>
    </Link>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`header ${scrolled || open ? "raised" : ""}`}>
      <div className="wrap header-inner">
        <Brand />
        <nav className="header-nav" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="header-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-end">
          <Link className="btn btn-primary header-cta" to="/#launch">
            Get notified
          </Link>
          <button
            type="button"
            className={`menu-button ${open ? "open" : ""}`}
            aria-expanded={open}
            aria-controls="menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="menu"
            className="menu"
            aria-label="Primary"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          >
            <div className="wrap">
              {[...NAV, ...MORE_NAV].map((item, index) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * index, type: "spring", duration: 0.3, bounce: 0 }}
                >
                  <NavLink to={item.to} className="menu-link">
                    {item.label}
                  </NavLink>
                </motion.div>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer dark">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <Brand />
          <p>The snooker app for scoring, practice and playing your friends. Coming soon to iPhone.</p>
        </div>
        <nav className="footer-cols" aria-label="Footer">
          <div>
            <h2>The app</h2>
            <Link to="/scoring">Scoring</Link>
            <Link to="/practice">Practice</Link>
            <Link to="/coach">Coach</Link>
            <Link to="/community">Community</Link>
            <Link to="/scan-snooker">Scan a Snooker</Link>
            <Link to="/plans">Plans</Link>
          </div>
          <div>
            <h2>Help</h2>
            <Link to="/support">Support</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>Email us</a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </nav>
        <p className="footer-legal">
          © {new Date().getFullYear()} Snookered. News headlines in the app belong to their publishers.
        </p>
      </div>
    </footer>
  );
}

/** Takes the page back to the top on navigation, as a normal page load would. */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    // Give the new page a frame to render before looking for the section.
    const timer = setTimeout(() => {
      const target = document.querySelector(hash);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo(0, 0);
    }, 60);
    return () => clearTimeout(timer);
  }, [pathname, hash]);
  return null;
}
