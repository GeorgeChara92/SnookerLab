// The routine layouts file the app reads (src/features/ar/routineLayouts.data.json): how it is
// checked before saving, and how it is written so a change shows up as a small, readable diff
// (one ball per line), not the whole file rewritten.

export const CATEGORIES = ["fundamentals", "break-building", "safety", "cueing", "cue-ball-control", "spin", "long-potting"];
export const COLORS = ["red", "yellow", "green", "brown", "blue", "pink", "black", "white"];
export const SPOT_IDS = ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"];

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/** Throws with a plain message if `data` isn't a layouts file the app can read. */
export function validateRoutines(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.routines)) throw new Error("Expected { routines: [...] }.");
  const seen = new Set();
  data.routines.forEach((routine, index) => {
    const where = `Routine ${index + 1}`;
    if (!routine || typeof routine !== "object") throw new Error(`${where} isn't an object.`);
    if (typeof routine.routineId !== "string" || !/^[a-z0-9-]+$/.test(routine.routineId)) throw new Error(`${where} has a bad routineId.`);
    if (seen.has(routine.routineId)) throw new Error(`${routine.routineId} is in the file twice.`);
    seen.add(routine.routineId);
    if (typeof routine.displayName !== "string" || !routine.displayName.trim()) throw new Error(`${routine.routineId} needs a name.`);
    if (!CATEGORIES.includes(routine.category)) throw new Error(`${routine.routineId} has an unknown category.`);
    if (!Array.isArray(routine.spotMarkers) || routine.spotMarkers.some((spot) => !SPOT_IDS.includes(spot))) {
      throw new Error(`${routine.routineId} has an unknown spot.`);
    }
    if (routine.notes !== undefined && typeof routine.notes !== "string") throw new Error(`${routine.routineId} notes must be text.`);
    if (!Array.isArray(routine.ballPlacements)) throw new Error(`${routine.routineId} needs a ballPlacements list.`);
    const ids = new Set();
    for (const ball of routine.ballPlacements) {
      if (!ball || typeof ball.id !== "string" || !ball.id) throw new Error(`${routine.routineId} has a ball with no id.`);
      if (ids.has(ball.id)) throw new Error(`${routine.routineId} has two balls called ${ball.id}.`);
      ids.add(ball.id);
      if (!COLORS.includes(ball.color)) throw new Error(`${routine.routineId}: ${ball.id} has an unknown colour.`);
      if (!isNumber(ball.x) || !isNumber(ball.y) || ball.x < 0 || ball.x > 1 || ball.y < 0 || ball.y > 1) {
        throw new Error(`${routine.routineId}: ${ball.id} is off the table.`);
      }
      if (ball.label !== undefined && typeof ball.label !== "string") throw new Error(`${routine.routineId}: ${ball.id} label must be text.`);
    }
  });
}

const round5 = (value) => Math.round(value * 100000) / 100000;
const json = (value) => JSON.stringify(value);

/** The file's text: stable key order, one ball per line, trailing newline. */
export function formatRoutinesFile(data) {
  const blocks = data.routines.map((routine) => {
    const lines = [
      `      "routineId": ${json(routine.routineId)}`,
      `      "displayName": ${json(routine.displayName.trim())}`,
      `      "category": ${json(routine.category)}`,
      `      "spotMarkers": ${json(routine.spotMarkers)}`,
    ];
    if (routine.notes && routine.notes.trim()) lines.push(`      "notes": ${json(routine.notes.trim())}`);
    const balls = routine.ballPlacements.map((ball) => {
      const parts = [`"id": ${json(ball.id)}`, `"color": ${json(ball.color)}`, `"x": ${round5(ball.x)}`, `"y": ${round5(ball.y)}`];
      if (ball.label) parts.push(`"label": ${json(ball.label)}`);
      return `        { ${parts.join(", ")} }`;
    });
    lines.push(balls.length ? `      "ballPlacements": [\n${balls.join(",\n")}\n      ]` : `      "ballPlacements": []`);
    return `    {\n${lines.join(",\n")}\n    }`;
  });
  return `{\n  "routines": [\n${blocks.join(",\n")}\n  ]\n}\n`;
}

/** routineId -> repo-relative image path, read from REFERENCE_IMAGES in routineLayouts.ts. */
export function readImageMap(tsSource) {
  const images = {};
  const pattern = /"(routine-[a-z0-9-]+)":\s*require\("((?:\.\.\/)+)(assets\/[^"]+)"\)/g;
  for (const match of tsSource.matchAll(pattern)) images[match[1]] = match[3];
  return images;
}
