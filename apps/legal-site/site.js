(() => {
  document.documentElement.classList.add("js");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Close the phone menu when a link is chosen or the page is tapped elsewhere.
  const menu = document.querySelector(".menu");
  if (menu) {
    document.addEventListener("click", (event) => {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.open) {
        menu.open = false;
        menu.querySelector("summary").focus();
      }
    });
  }

  // Sections ease in once, as they come on screen.
  const reveals = document.querySelectorAll(".rv");
  if (reduced || !("IntersectionObserver" in window)) {
    reveals.forEach((node) => node.classList.add("in"));
  } else {
    const seen = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          seen.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((node) => seen.observe(node));
  }

  // The home scoreboard: a break built ball by ball until the frame is won, then again.
  const $ = (id) => document.getElementById(id);
  const youPoints = $("demo-you-points");
  const balls = $("demo-balls");
  if (!youPoints || !balls) return;
  const themPoints = $("demo-them-points");
  const youFrames = $("demo-you-frames");
  const breakValue = $("demo-break");
  const atYou = $("at-you");

  const VALUE = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 };
  const BREAK = ["red", "black", "red", "black", "red", "pink", "red", "black", "red", "black",
    "red", "blue", "red", "black", "red", "black", "red", "pink", "red", "black"];

  const bump = (node) => {
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
  };

  const addBall = (colour) => {
    const ball = document.createElement("i");
    ball.className = colour;
    balls.appendChild(ball);
  };

  const reset = () => {
    youPoints.textContent = "0";
    themPoints.textContent = "38";
    youFrames.textContent = "2";
    breakValue.textContent = "0";
    balls.replaceChildren();
    atYou.classList.add("on");
  };

  if (reduced) {
    reset();
    let total = 0;
    BREAK.slice(0, 12).forEach((colour) => {
      addBall(colour);
      total += VALUE[colour];
    });
    youPoints.textContent = String(total);
    breakValue.textContent = String(total);
    return;
  }

  let step = 0;
  let total = 0;
  const tick = () => {
    if (step === 0) {
      reset();
      total = 0;
    }
    if (step < BREAK.length) {
      const colour = BREAK[step];
      total += VALUE[colour];
      addBall(colour);
      youPoints.textContent = String(total);
      breakValue.textContent = String(total);
      bump(youPoints);
      step += 1;
      setTimeout(tick, colour === "red" ? 700 : 950);
      return;
    }
    youFrames.textContent = "3";
    bump(youFrames);
    atYou.classList.remove("on");
    step = 0;
    setTimeout(tick, 3600);
  };

  let started = false;
  const watch = new IntersectionObserver(
    (entries) => {
      if (!started && entries.some((entry) => entry.isIntersecting)) {
        started = true;
        setTimeout(tick, 600);
      }
    },
    { threshold: 0.3 }
  );
  watch.observe(balls.closest(".board"));
})();
