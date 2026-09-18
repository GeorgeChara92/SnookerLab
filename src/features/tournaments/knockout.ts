import type { TournamentFixture, TournamentPairingMode } from "../../types";

export const isBye = (value: string) => value === "BYE" || /^BYE\b/i.test(value);
export const isRealName = (value: string) => !isBye(value) && value !== "TBD";

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const shuffled = (items: string[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

export const nextPowerOfTwo = (value: number) => {
  let p = 1;
  while (p < value) p *= 2;
  return p;
};

/**
 * Round-one slots for a random draw. Every BYE is paired with a real player, and the
 * walkovers are spread evenly through the bracket rather than bunched in one half.
 */
export const buildRandomDrawSlots = (participants: string[]): string[] => {
  const real = shuffled(participants.filter(isRealName));
  const fixtureCount = nextPowerOfTwo(Math.max(2, real.length)) / 2;
  const byeCount = fixtureCount * 2 - real.length;

  const slots: string[] = [];
  let byesPlaced = 0;
  for (let index = 0; index < fixtureCount; index += 1) {
    const byesDue = Math.floor(((index + 1) * byeCount) / fixtureCount);
    const playerA = real.shift() ?? "BYE";
    if (byesPlaced < byesDue) {
      slots.push(playerA, "BYE");
      byesPlaced += 1;
    } else {
      slots.push(playerA, real.shift() ?? "BYE");
    }
  }
  return slots;
};

const clearResult = (fixture: TournamentFixture) => {
  fixture.status = "pending";
  fixture.winner = undefined;
  fixture.score_a = undefined;
  fixture.score_b = undefined;
  fixture.frame_scores = undefined;
};

const resolveBye = (fixture: TournamentFixture) => {
  const byeA = isBye(fixture.participant_a);
  const byeB = isBye(fixture.participant_b);

  if (byeA && byeB) {
    // An empty slot: carry the BYE forward so the next round becomes a walkover
    // instead of waiting forever for an opponent.
    fixture.status = "completed";
    fixture.winner = "BYE";
    fixture.score_a = 0;
    fixture.score_b = 0;
    fixture.frame_scores = [];
    return;
  }

  if (byeA && isRealName(fixture.participant_b)) {
    fixture.status = "completed";
    fixture.winner = fixture.participant_b;
    fixture.score_a = 0;
    fixture.score_b = 1;
    fixture.frame_scores = [{ frame_number: 1, score_a: 0, score_b: 1, winner: "b" }];
    return;
  }

  if (byeB && isRealName(fixture.participant_a)) {
    fixture.status = "completed";
    fixture.winner = fixture.participant_a;
    fixture.score_a = 1;
    fixture.score_b = 0;
    fixture.frame_scores = [{ frame_number: 1, score_a: 1, score_b: 0, winner: "a" }];
    return;
  }

  if (!isRealName(fixture.participant_a) || !isRealName(fixture.participant_b)) {
    clearResult(fixture);
  }
};

export const recomputeKnockoutTree = (fixtures: TournamentFixture[]) => {
  const next = fixtures
    .map((fixture) => ({ ...fixture }))
    .sort((a, b) => a.round_number - b.round_number || a.fixture_index - b.fixture_index);

  const maxRound = Math.max(...next.map((fixture) => fixture.round_number), 1);
  const byRoundAndIndex = (round: number, index: number) =>
    next.find((fixture) => fixture.round_number === round && fixture.fixture_index === index);

  next.filter((fixture) => fixture.round_number === 1).forEach(resolveBye);

  for (let round = 2; round <= maxRound; round += 1) {
    const currentRoundFixtures = next
      .filter((fixture) => fixture.round_number === round)
      .sort((a, b) => a.fixture_index - b.fixture_index);

    currentRoundFixtures.forEach((fixture) => {
      const previousA = byRoundAndIndex(round - 1, fixture.fixture_index * 2);
      const previousB = byRoundAndIndex(round - 1, fixture.fixture_index * 2 + 1);

      const participantA = previousA?.status === "completed" && previousA.winner ? previousA.winner : "TBD";
      const participantB = previousB?.status === "completed" && previousB.winner ? previousB.winner : "TBD";

      const changed = fixture.participant_a !== participantA || fixture.participant_b !== participantB;
      fixture.participant_a = participantA;
      fixture.participant_b = participantB;

      if (changed) clearResult(fixture);

      resolveBye(fixture);
    });
  }

  return next;
};

export const buildKnockoutFixtures = (
  tournamentId: string,
  participants: string[],
  bestOfFrames: number,
  pairingMode: TournamentPairingMode,
  manualFixtures?: Array<{ participantA: string; participantB: string }>
) => {
  // Manual pairings are kept exactly as entered; empty slots are padded with BYEs.
  let slots = manualFixtures?.length
    ? manualFixtures.flatMap((fixture) => [fixture.participantA, fixture.participantB])
    : buildRandomDrawSlots(participants);

  const drawSize = nextPowerOfTwo(Math.max(2, slots.length));
  if (slots.length < drawSize) {
    slots = [...slots, ...Array.from({ length: drawSize - slots.length }, () => "BYE")];
  }

  const fixtures: TournamentFixture[] = [];
  let matchesInRound = drawSize / 2;

  for (let round = 1; matchesInRound >= 1; round += 1) {
    for (let index = 0; index < matchesInRound; index += 1) {
      fixtures.push({
        id: makeId(),
        tournament_id: tournamentId,
        round_number: round,
        fixture_index: index,
        participant_a: round === 1 ? slots[index * 2] ?? "BYE" : "TBD",
        participant_b: round === 1 ? slots[index * 2 + 1] ?? "BYE" : "TBD",
        best_of_frames: bestOfFrames,
        status: "pending",
      });
    }

    matchesInRound = Math.floor(matchesInRound / 2);
  }

  return recomputeKnockoutTree(fixtures);
};
