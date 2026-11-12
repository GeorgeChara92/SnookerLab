import type { Point } from "./table";

/**
 * Balls drawn bigger than life, for a picture of a routine, without any overlapping.
 *
 * At true size a ball is a dot on a phone-sized table. Enlarging every ball by the same amount
 * makes them easy to see, but balls that touch on the table would then overlap - which is why a
 * routine with a pack used to be drawn with every ball at true size (seen 2026-11-12). Instead,
 * each group of balls that would overlap is spread out from its own middle by just enough that its
 * closest two touch again. A pack stays a pack, only bigger, and stays where it was; balls far
 * from anything don't move at all. Done a few times over, in case a spread group now reaches a
 * neighbour.
 *
 * Only for drawing: where the balls really are is never changed.
 */
export const spreadForDisplay = <T extends Point>(balls: T[], diameter: number, rounds = 4): T[] => {
  let out = balls.map((ball) => ({ ...ball }));
  for (let round = 0; round < rounds; round += 1) {
    const parent = out.map((_, index) => index);
    const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
    let overlapping = false;
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        if (Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) < diameter - 0.01) {
          parent[find(i)] = find(j);
          overlapping = true;
        }
      }
    }
    if (!overlapping) break;

    const groups = new Map<number, number[]>();
    out.forEach((_, index) => {
      const root = find(index);
      groups.set(root, [...(groups.get(root) ?? []), index]);
    });
    const next = out.map((ball) => ({ ...ball }));
    groups.forEach((members) => {
      if (members.length < 2) return;
      let closest = Infinity;
      for (let a = 0; a < members.length; a += 1) {
        for (let b = a + 1; b < members.length; b += 1) {
          const p = out[members[a]];
          const q = out[members[b]];
          closest = Math.min(closest, Math.hypot(p.x - q.x, p.y - q.y));
        }
      }
      // Two balls in exactly the same place can't be spread apart; leave them be.
      if (closest < 1) return;
      const grow = diameter / closest;
      const cx = members.reduce((sum, index) => sum + out[index].x, 0) / members.length;
      const cy = members.reduce((sum, index) => sum + out[index].y, 0) / members.length;
      members.forEach((index) => {
        next[index].x = cx + (out[index].x - cx) * grow;
        next[index].y = cy + (out[index].y - cy) * grow;
      });
    });
    out = next;
  }
  return out;
};
