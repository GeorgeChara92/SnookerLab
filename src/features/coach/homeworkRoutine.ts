import type { Routine } from "../../types";
import { useCustomRoutinesStore } from "../../store";
import { getSharedRoutine, publishRoutine, recordSave } from "../community/sharedRoutines";
import type { CustomRoutine } from "../customRoutines/customRoutine";
import type { Homework } from "./types";

/**
 * Homework on a coach's own routine. A client can't open a routine that only lives in the coach's
 * account, so it is set as the routine's shared copy - "shared:<id>", the same key its leaderboard
 * uses - privately (link only, never listed in the community library) unless the coach has already
 * shared it. The client practises their own saved copy of it, and scores on that copy count.
 */

const SHARED_PREFIX = "shared:";

/** The shared routine a piece of homework points at, or null for a library routine. */
export const sharedIdOfHomework = (routineId: string): string | null =>
  routineId.startsWith(SHARED_PREFIX) ? routineId.slice(SHARED_PREFIX.length) : null;

/** Every routine id whose scores count towards this homework: the routine itself and, for a coach's
 * own routine, the player's saved copies of it. */
export const homeworkRoutineIds = (homework: Pick<Homework, "routineId">, custom: CustomRoutine[]): Set<string> => {
  const ids = new Set([homework.routineId]);
  const shared = sharedIdOfHomework(homework.routineId);
  if (shared) {
    for (const routine of custom) {
      if (routine.sourceSharedId === shared || routine.sharedId === shared) ids.add(routine.id);
    }
  }
  return ids;
};

type Resolved = { ok: true; routineId: string; routineName: string } | { ok: false; message: string };

/** What to store as the homework's routine: a library routine as it is; one of the coach's own
 * routines as its shared copy, sharing it privately first if it hasn't been shared yet. */
export const resolveHomeworkRoutine = async (routine: Routine): Promise<Resolved> => {
  const store = useCustomRoutinesStore.getState();
  const custom = store.getById(routine.id);
  if (!custom) return { ok: true, routineId: routine.id, routineName: routine.name };
  const existing = custom.sharedId ?? custom.sourceSharedId;
  if (existing) return { ok: true, routineId: `${SHARED_PREFIX}${existing}`, routineName: custom.name };
  const published = await publishRoutine(custom, "link");
  if (!published.ok) return { ok: false, message: published.message };
  store.setShared(custom.id, published.value);
  return { ok: true, routineId: `${SHARED_PREFIX}${published.value}`, routineName: custom.name };
};

/**
 * Where a player's "Start" on a piece of homework goes. A library routine opens as usual. A coach's
 * own routine opens the player's saved copy, saving one first if they haven't yet, so it is ready
 * to set up and score straight away. Returns the custom routine's id, or null if the coach has
 * since stopped sharing it.
 */
export const openableHomeworkRoutine = async (
  routineId: string
): Promise<{ kind: "library"; routineId: string } | { kind: "custom"; routineId: string } | { kind: "gone"; sharedId: string }> => {
  const shared = sharedIdOfHomework(routineId);
  if (!shared) return { kind: "library", routineId };
  const store = useCustomRoutinesStore.getState();
  const copy = store.routines.find((item) => item.sourceSharedId === shared || item.sharedId === shared);
  if (copy) return { kind: "custom", routineId: copy.id };
  const routine = await getSharedRoutine(shared);
  if (!routine) return { kind: "gone", sharedId: shared };
  const saved = store.save({
    name: routine.name,
    description: routine.description,
    maxScore: routine.maxScore,
    balls: routine.balls,
    sourceSharedId: shared,
  });
  void recordSave(shared);
  return { kind: "custom", routineId: saved.id };
};

/** A player's "Start" on a piece of homework, from anywhere in the player's tabs. */
export const startHomework = async (navigation: { navigate: (...args: any[]) => void }, routineId: string) => {
  const target = await openableHomeworkRoutine(routineId);
  if (target.kind === "library") {
    navigation.navigate("Practice", { screen: "RoutineDetail", params: { routineId: target.routineId }, initial: false });
  } else if (target.kind === "custom") {
    navigation.navigate("Practice", { screen: "CustomRoutine", params: { routineId: target.routineId }, initial: false });
  } else {
    // Shows "This routine is no longer shared" - the coach has deleted or unshared it.
    navigation.navigate("Community", { screen: "SharedRoutine", params: { id: target.sharedId }, initial: false });
  }
};
