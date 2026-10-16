import { Bell, Play, Star } from "lucide-react";

/*
 * The pro tour screens, drawn in the site's own broadcast style rather than as screenshots. The
 * players and scores are illustrative: the app itself shows the real tour, live.
 */

/** A live match card: the tournament and round, both players, the frames, where to watch. */
export function TourLiveCard() {
  return (
    <div className="tour-card" aria-hidden="true">
      <div className="tour-card-head">
        <span className="live-pill">
          <i />
          Live
        </span>
        <span className="tour-meta">Quarter-finals · Best of 9</span>
      </div>
      <p className="tour-event">Northern Ireland Open</p>
      {[
        { name: "J. Ashworth", frames: 3, lead: true },
        { name: "L. Chen", frames: 2 },
      ].map((side) => (
        <div className={`tour-row ${side.lead ? "lead" : ""}`} key={side.name}>
          <span className="tour-avatar">{side.name.split(" ").pop()?.[0]}</span>
          <span className="tour-name">{side.name}</span>
          <span className="tour-frames">{side.frames}</span>
        </div>
      ))}
      <div className="tour-card-foot">
        <span className="tour-watch">
          <Play strokeWidth={2.25} />
          Watch live
        </span>
        <span className="tour-meta">Evening session 19:00 your time</span>
      </div>
    </div>
  );
}

const BRACKET: { round: string; matches: [string, number | null, string, number | null, boolean?][] }[] = [
  {
    round: "Quarters",
    matches: [
      ["Ashworth", 5, "Chen", 3, true],
      ["Okafor", 5, "Lindqvist", 4, true],
      ["Hale", 2, "Moreno", 5, true],
      ["Byrne", 3, "Tanaka", 2],
    ],
  },
  {
    round: "Semis",
    matches: [
      ["Ashworth", null, "Okafor", null],
      ["Moreno", null, "Byrne v Tanaka", null],
    ],
  },
  { round: "Final", matches: [["Winner of SF1", null, "Winner of SF2", null]] },
];

/** The draw as a tree, quarter-finals to the final, with "winner of" slots still to fill. */
export function TourBracket() {
  return (
    <div className="tour-bracket" aria-hidden="true">
      {BRACKET.map((column, c) => (
        <div className="tour-col" key={column.round} style={{ ["--depth" as string]: c }}>
          <p className="tour-col-head">{column.round}</p>
          <div className="tour-col-matches">
            {column.matches.map(([a, sa, b, sb, done], i) => {
              const live = !done && sa === 3;
              const aWon = done && (sa ?? 0) > (sb ?? 0);
              const bWon = done && (sb ?? 0) > (sa ?? 0);
              const pending = (name: string) => /winner|\sv\s/i.test(name);
              return (
                <div className={`tour-slot ${live ? "live" : ""}`} key={i}>
                  {[
                    [a, sa, aWon, done && !aWon],
                    [b, sb, bWon, done && !bWon],
                  ].map(([name, score, won, lost], j) => (
                    <div key={j} className={`tour-slot-row ${won ? "won" : ""} ${lost ? "lost" : ""}`}>
                      <span className={pending(name as string) ? "pending" : ""}>
                        {pending(name as string) && !(name as string).startsWith("Winner") ? `Winner of ${name}` : (name as string)}
                      </span>
                      {score != null && <b>{score as number}</b>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The match centre: frame by frame, then the head-to-head. */
export function TourMatchCentre() {
  const frames = [
    ["72", "18", "64"],
    ["0", "131", "131"],
    ["68", "41", null],
    ["9", "77", "77"],
    ["101", "0", "101"],
  ];
  return (
    <div className="tour-card light" aria-hidden="true">
      <p className="tour-kicker">Frame by frame</p>
      <div className="tour-frames-grid">
        {frames.map(([a, b, brk], i) => (
          <span key={i} className="tour-frame">
            <span>
              <b className={Number(a) > Number(b) ? "won" : ""}>{a}</b>–<b className={Number(b) > Number(a) ? "won" : ""}>{b}</b>
            </span>
            {brk && <small>{brk}</small>}
          </span>
        ))}
      </div>
      <p className="tour-kicker">Head to head</p>
      <div className="tour-h2h">
        <span>Ashworth</span>
        <b>7–4</b>
        <span>Chen</span>
      </div>
      <div className="tour-h2h-bar">
        <i style={{ flex: 7 }} />
        <i style={{ flex: 4 }} />
      </div>
      <ul className="tour-meetings">
        <li>
          <span>2026 · English Open</span>
          <b>4–2</b>
        </li>
        <li>
          <span>2025 · UK Championship</span>
          <b>5–6</b>
        </li>
        <li>
          <span>2025 · Welsh Open</span>
          <b>4–1</b>
        </li>
      </ul>
    </div>
  );
}

/** Following players: the push when their match starts, and their matches pinned at the top. */
export function TourFollow() {
  return (
    <div className="tour-follow" aria-hidden="true">
      <div className="tour-push">
        <span className="tour-push-icon">S</span>
        <div>
          <p>
            <b>Live now: Ashworth v Chen</b>
          </p>
          <p>Northern Ireland Open · Quarter-finals is under way.</p>
        </div>
        <small>now</small>
      </div>
      <div className="tour-card light">
        <p className="tour-kicker">
          <Star strokeWidth={2.25} /> Your players
        </p>
        {[
          { name: "J. Ashworth", line: "3–2 v Chen", live: true },
          { name: "M. Okafor", line: "Tomorrow 13:00 v Lindqvist" },
          { name: "S. Moreno", line: "Beat Hale 5–2" },
        ].map((row) => (
          <div className="tour-yours" key={row.name}>
            <span className="tour-avatar">{row.name.split(" ").pop()?.[0]}</span>
            <div>
              <b>{row.name}</b>
              <span className={row.live ? "live" : ""}>{row.line}</span>
            </div>
          </div>
        ))}
        <span className="tour-follow-btn">
          <Bell strokeWidth={2.25} /> Following
        </span>
      </div>
    </div>
  );
}

/** The money rankings, with a player's season at a glance. */
export function TourRankings() {
  const rows = [
    ["1", "J. Ashworth", "£1,240,500"],
    ["2", "S. Moreno", "£1,108,000"],
    ["3", "L. Chen", "£986,250"],
    ["4", "M. Okafor", "£912,000"],
    ["5", "K. Tanaka", "£874,500"],
  ];
  return (
    <div className="tour-card light" aria-hidden="true">
      <p className="tour-kicker">Money rankings 2026/27</p>
      {rows.map(([pos, name, money]) => (
        <div className="tour-rank" key={pos}>
          <b className="tour-pos">{pos}</b>
          <span className="tour-avatar">{name.split(" ").pop()?.[0]}</span>
          <span className="tour-rank-name">{name}</span>
          <span className="tour-money">{money}</span>
        </div>
      ))}
      <div className="tour-form">
        <span>This season</span>
        <b>23–7</b>
        {["W", "W", "L", "W", "W"].map((r, i) => (
          <i key={i} className={r === "W" ? "w" : "l"}>
            {r}
          </i>
        ))}
      </div>
    </div>
  );
}
