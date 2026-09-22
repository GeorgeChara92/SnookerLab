(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // The hero scoreboard: a break built ball by ball until the frame is won, then again.
  const $ = (id) => document.getElementById(id);
  const youPoints = $("demo-you-points");
  const themPoints = $("demo-them-points");
  const youFrames = $("demo-you-frames");
  const breakValue = $("demo-break");
  const balls = $("demo-balls");
  const frameNo = $("demo-frame");
  const atYou = $("at-you");
  const atThem = $("at-them");
  if (!youPoints || !balls) return;

  const VALUE = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 };
  // A 76 break: reds with colours, mostly the black.
  const BREAK = ["red", "black", "red", "black", "red", "pink", "red", "black", "red", "black",
    "red", "blue", "red", "black", "red", "black", "red", "pink", "red", "black"];

  const bump = (node) => {
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
  };

  const reset = () => {
    youPoints.textContent = "0";
    themPoints.textContent = "38";
    youFrames.textContent = "2";
    breakValue.textContent = "0";
    frameNo.textContent = "4";
    balls.innerHTML = "";
    atYou.classList.add("on");
    atThem.classList.remove("on");
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    // A still frame: the break partway through.
    reset();
    let total = 0;
    BREAK.slice(0, 12).forEach((colour) => {
      const ball = document.createElement("i");
      ball.className = colour;
      balls.appendChild(ball);
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
      const ball = document.createElement("i");
      ball.className = colour;
      balls.appendChild(ball);
      youPoints.textContent = String(total);
      breakValue.textContent = String(total);
      bump(youPoints);
      step += 1;
      setTimeout(tick, colour === "red" ? 700 : 950);
      return;
    }
    // Frame won: the frames tick over, then a pause before it all starts again.
    youFrames.textContent = "3";
    bump(youFrames);
    atYou.classList.remove("on");
    step = 0;
    setTimeout(tick, 3600);
  };

  // Only run while the scoreboard is on screen.
  let started = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !started) {
        started = true;
        setTimeout(tick, 600);
      }
    },
    { threshold: 0.3 }
  );
  observer.observe(balls.closest(".board"));
})();
