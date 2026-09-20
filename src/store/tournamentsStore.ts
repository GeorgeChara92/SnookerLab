import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import {
  Tournament,
  TournamentEntryMode,
  TournamentFrameScore,
  TournamentFixture,
  TournamentPairingMode,
  TournamentType,
} from "../types";
import { supabase } from "../api/supabase";
import { buildKnockoutFixtures, isBye, recomputeKnockoutTree } from "../features/tournaments/knockout";
import { computeLeagueStandings } from "../features/tournaments/leagueStandings";
import { buildLeagueSchedule } from "../features/tournaments/leagueSchedule";
import { dateKeyFrom, todayKey } from "../utils/date";

type CreateTournamentInput = {
  name: string;
  tournamentType: TournamentType;
  entryMode: TournamentEntryMode;
  pairingMode: TournamentPairingMode;
  bestOfFrames: number;
  /** League only: how many times each pair plays each other. */
  meetings?: number;
  participants: string[];
  previousChampion?: string;
  notes?: string;
  manualFixtures?: Array<{ participantA: string; participantB: string }>;
};

interface TournamentsState {
  ownerUserId: string | null;
  tournaments: Tournament[];
  createTournament: (input: CreateTournamentInput) => Promise<string>;
  restartTournament: (
    tournamentId: string,
    options?: { pairingMode?: TournamentPairingMode; preserveManualPairs?: boolean }
  ) => Promise<string | null>;
  updateFixtureResult: (
    tournamentId: string,
    fixtureId: string,
    result: { frameScores: TournamentFrameScore[] }
  ) => Promise<void>;
  deleteTournament: (tournamentId: string) => Promise<void>;
  getTournamentById: (tournamentId: string) => Tournament | undefined;
  setOwnerUserId: (userId: string | null) => void;
  hydrateTournamentsForUser: (userId: string) => Promise<void>;
}

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildLeagueFixtures = (
  tournamentId: string,
  participants: string[],
  bestOfFrames: number,
  meetings = 1
) => {
  const list = participants.filter((name) => !isBye(name));
  const indexInRound = new Map<number, number>();

  return buildLeagueSchedule(list, meetings).map((tie) => {
    const position = indexInRound.get(tie.round) ?? 0;
    indexInRound.set(tie.round, position + 1);

    return {
      id: makeId(),
      tournament_id: tournamentId,
      round_number: tie.round,
      fixture_index: position,
      participant_a: tie.home,
      participant_b: tie.away,
      best_of_frames: Math.max(1, bestOfFrames),
      status: "pending",
    } as TournamentFixture;
  });
};

const getTournamentChampion = (tournament: Tournament): string | null => {
  if (tournament.tournament_type === "knockout") {
    const finalRound = Math.max(...tournament.fixtures.map((fixture) => fixture.round_number), 1);
    const finalFixture = tournament.fixtures.find((fixture) => fixture.round_number === finalRound);
    return finalFixture?.winner ?? null;
  }

  return computeLeagueStandings(tournament.participants, tournament.fixtures)[0]?.name ?? null;
};

const mapTournamentRow = (row: any, fixtures: TournamentFixture[]): Tournament => ({
  id: row.id,
  name: row.name,
  date: row.created_at ? dateKeyFrom(row.created_at) : todayKey(),
  tournament_type: row.tournament_type,
  entry_mode: row.entry_mode,
  pairing_mode: row.pairing_mode,
  best_of_frames: row.best_of_frames,
  participants: row.participants ?? [],
  fixtures,
  status: row.status,
  previous_champion: row.previous_champion ?? undefined,
  notes: row.notes ?? undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const useTournamentsStore = create<TournamentsState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      tournaments: [],

      createTournament: async (input) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to create tournaments.");

        const now = new Date().toISOString();
        const raw = input.participants.map((name) => name.trim()).filter(Boolean);
        const participants = Array.from(new Set(raw.map((name) => name.replace(/\s+/g, " "))));

        const localFixtures =
          input.tournamentType === "knockout"
            ? buildKnockoutFixtures(makeId(), participants, input.bestOfFrames, input.pairingMode, input.manualFixtures)
            : buildLeagueFixtures(makeId(), participants, input.bestOfFrames, input.meetings ?? 1);

        const status = localFixtures.every((fixture) => fixture.status === "completed") ? "completed" : "active";

        const { data: tournamentRow, error: tournamentError } = await supabase
          .from("tournaments")
          .insert({
            user_id: authUser.id,
            name: input.name.trim(),
            tournament_type: input.tournamentType,
            entry_mode: input.entryMode,
            pairing_mode: input.pairingMode,
            best_of_frames: input.bestOfFrames,
            participants,
            status,
            previous_champion: input.previousChampion ?? null,
            notes: input.notes?.trim() || null,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (tournamentError) throw tournamentError;

        const fixturePayload = localFixtures.map((fixture) => ({
          tournament_id: tournamentRow.id,
          round_number: fixture.round_number,
          fixture_index: fixture.fixture_index,
          participant_a: fixture.participant_a,
          participant_b: fixture.participant_b,
          best_of_frames: fixture.best_of_frames,
          score_a: fixture.score_a ?? null,
          score_b: fixture.score_b ?? null,
          winner: fixture.winner ?? null,
          status: fixture.status,
        }));

        const { data: fixtureRows, error: fixtureError } = await supabase
          .from("tournament_fixtures")
          .insert(fixturePayload)
          .select();

        if (fixtureError) throw fixtureError;

        const framePayload = (fixtureRows ?? []).flatMap((row) => {
          const local = localFixtures.find(
            (fixture) => fixture.round_number === row.round_number && fixture.fixture_index === row.fixture_index
          );
          const frames = local?.frame_scores ?? [];
          return frames.map((frame) => ({
            fixture_id: row.id,
            frame_number: frame.frame_number,
            score_a: frame.score_a,
            score_b: frame.score_b,
            winner: frame.winner,
          }));
        });

        if (framePayload.length) {
          const { error } = await supabase.from("tournament_fixture_frames").insert(framePayload);
          if (error) throw error;
        }

        const fixtures: TournamentFixture[] = (fixtureRows ?? []).map((row) => {
          const local = localFixtures.find(
            (fixture) => fixture.round_number === row.round_number && fixture.fixture_index === row.fixture_index
          );
          return {
            id: row.id,
            tournament_id: row.tournament_id,
            round_number: row.round_number,
            fixture_index: row.fixture_index,
            participant_a: row.participant_a,
            participant_b: row.participant_b,
            best_of_frames: row.best_of_frames,
            score_a: row.score_a ?? undefined,
            score_b: row.score_b ?? undefined,
            winner: row.winner ?? undefined,
            status: row.status,
            frame_scores: local?.frame_scores,
          };
        });

        const tournament = mapTournamentRow(tournamentRow, fixtures);
        set((state) => ({ tournaments: [tournament, ...state.tournaments] }));
        return tournament.id;
      },

      restartTournament: async (tournamentId, options) => {
        const existing = get().tournaments.find((item) => item.id === tournamentId);
        if (!existing) return null;

        const restartPairingMode =
          existing.tournament_type === "knockout"
            ? options?.pairingMode ?? existing.pairing_mode
            : existing.pairing_mode;
        const preserveManual = options?.preserveManualPairs ?? true;
        const previousChampion = getTournamentChampion(existing);

        return get().createTournament({
          name: `${existing.name} Rematch`,
          tournamentType: existing.tournament_type,
          entryMode: existing.entry_mode,
          pairingMode: restartPairingMode,
          bestOfFrames: existing.best_of_frames,
          participants: existing.participants,
          notes:
            previousChampion
              ? `Previous champion: ${previousChampion}${existing.notes ? ` | ${existing.notes}` : ""}`
              : existing.notes,
          previousChampion: previousChampion ?? undefined,
          manualFixtures:
            restartPairingMode === "manual" && preserveManual
              ? existing.fixtures
                  .filter((fixture) => fixture.round_number === 1)
                  .sort((a, b) => a.fixture_index - b.fixture_index)
                  .map((fixture) => ({ participantA: fixture.participant_a, participantB: fixture.participant_b }))
              : undefined,
        });
      },

      updateFixtureResult: async (tournamentId, fixtureId, result) => {
        const tournament = get().tournaments.find((item) => item.id === tournamentId);
        if (!tournament) return;

        const previousFixtures = tournament.fixtures;
        const previousStatus = tournament.status;
        const previousUpdatedAt = tournament.updated_at;

        const updated = tournament.fixtures.map((fixture) => {
          // Untouched ties keep their identity, so the rows on screen do not rebuild their
          // frame inputs every time someone else's result is saved.
          if (fixture.id !== fixtureId) return fixture;
          const aWins = result.frameScores.filter((frame) => frame.winner === "a").length;
          const bWins = result.frameScores.filter((frame) => frame.winner === "b").length;
          const requiredWins = Math.floor(fixture.best_of_frames / 2) + 1;
          const hasWinner = aWins >= requiredWins || bWins >= requiredWins;
          const winner = hasWinner ? (aWins > bWins ? fixture.participant_a : fixture.participant_b) : undefined;
          return {
            ...fixture,
            frame_scores: result.frameScores,
            score_a: aWins,
            score_b: bWins,
            winner,
            status: hasWinner ? ("completed" as const) : ("pending" as const),
          };
        });

        const fixtures = tournament.tournament_type === "knockout" ? recomputeKnockoutTree(updated) : updated;
        const allComplete = fixtures.every((fixture) => fixture.status === "completed");
        const finalRound = Math.max(...fixtures.map((fixture) => fixture.round_number), 1);
        const finalFixture = fixtures.find((fixture) => fixture.round_number === finalRound);
        const hasKnockoutChampion = tournament.tournament_type === "knockout" && !!finalFixture?.winner;
        const status = allComplete || hasKnockoutChampion ? "completed" : "active";
        const updatedAt = new Date().toISOString();

        // The screen reads from here, so it updates now rather than after the network settles.
        // If any of the writes below fail the whole thing is put back.
        set((state) => ({
          tournaments: state.tournaments.map((item) =>
            item.id === tournamentId ? { ...item, fixtures, status, updated_at: updatedAt } : item
          ),
        }));

        // Saving one scoreline used to rewrite every fixture and every frame in the tournament,
        // which is ninety round trips in a decent sized league. Only send what actually moved:
        // the tie that was edited, plus whatever the knockout recompute carried forward.
        const before = new Map(previousFixtures.map((fixture) => [fixture.id, fixture]));
        const framesOf = (fixture?: TournamentFixture) =>
          (fixture?.frame_scores ?? [])
            .map((frame) => `${frame.frame_number}:${frame.score_a}:${frame.score_b}:${frame.winner}`)
            .join("|");

        const changed = fixtures.filter((fixture) => {
          const prior = before.get(fixture.id);
          if (!prior) return true;
          return (
            prior.participant_a !== fixture.participant_a ||
            prior.participant_b !== fixture.participant_b ||
            prior.score_a !== fixture.score_a ||
            prior.score_b !== fixture.score_b ||
            prior.winner !== fixture.winner ||
            prior.status !== fixture.status ||
            framesOf(prior) !== framesOf(fixture)
          );
        });

        try {
          const results = await Promise.all(
            changed.map((fixture) =>
              supabase
                .from("tournament_fixtures")
                .update({
                  participant_a: fixture.participant_a,
                  participant_b: fixture.participant_b,
                  score_a: fixture.score_a ?? null,
                  score_b: fixture.score_b ?? null,
                  winner: fixture.winner ?? null,
                  status: fixture.status,
                })
                .eq("id", fixture.id)
            )
          );

          const failed = results.find((item) => item.error);
          if (failed?.error) throw failed.error;

          const reframed = changed.filter((fixture) => framesOf(before.get(fixture.id)) !== framesOf(fixture));

          if (reframed.length) {
            const deletions = await Promise.all(
              reframed.map((fixture) =>
                supabase.from("tournament_fixture_frames").delete().eq("fixture_id", fixture.id)
              )
            );
            const failedDelete = deletions.find((item) => item.error);
            if (failedDelete?.error) throw failedDelete.error;

            const framePayload = reframed.flatMap((fixture) =>
              (fixture.frame_scores ?? []).map((frame) => ({
                fixture_id: fixture.id,
                frame_number: frame.frame_number,
                score_a: frame.score_a,
                score_b: frame.score_b,
                winner: frame.winner,
              }))
            );

            if (framePayload.length) {
              const { error } = await supabase.from("tournament_fixture_frames").insert(framePayload);
              if (error) throw error;
            }
          }

          const { error: tournamentError } = await supabase
            .from("tournaments")
            .update({ status, updated_at: updatedAt })
            .eq("id", tournamentId);
          if (tournamentError) throw tournamentError;
        } catch (error) {
          // Put back only what this save touched, so a result saved alongside it survives.
          const reverting = new Set(changed.map((fixture) => fixture.id));
          set((state) => ({
            tournaments: state.tournaments.map((item) =>
              item.id === tournamentId
                ? {
                    ...item,
                    fixtures: item.fixtures.map((fixture) =>
                      reverting.has(fixture.id) ? before.get(fixture.id) ?? fixture : fixture
                    ),
                    status: previousStatus,
                    updated_at: previousUpdatedAt,
                  }
                : item
            ),
          }));
          throw error;
        }
      },

      deleteTournament: async (tournamentId) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to delete tournaments.");

        const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId).eq("user_id", authUser.id);
        if (error) throw error;

        set((state) => ({ tournaments: state.tournaments.filter((t) => t.id !== tournamentId) }));
      },

      getTournamentById: (tournamentId) => get().tournaments.find((t) => t.id === tournamentId),

      setOwnerUserId: (userId) => {
        set((state) => {
          if (state.ownerUserId === userId) return state;
          return { ownerUserId: userId, tournaments: [] };
        });
      },

      hydrateTournamentsForUser: async (userId) => {
        const { data: tournamentRows, error: tournamentError } = await supabase
          .from("tournaments")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (tournamentError) throw tournamentError;

        const tournamentIds = (tournamentRows ?? []).map((row) => row.id);
        if (!tournamentIds.length) {
          set({ tournaments: [] });
          return;
        }

        const { data: fixtureRows, error: fixtureError } = await supabase
          .from("tournament_fixtures")
          .select("*")
          .in("tournament_id", tournamentIds)
          .order("round_number", { ascending: true })
          .order("fixture_index", { ascending: true });

        if (fixtureError) throw fixtureError;

        const fixtureIds = (fixtureRows ?? []).map((row) => row.id);
        let frameRows: any[] = [];
        if (fixtureIds.length) {
          const { data, error } = await supabase
            .from("tournament_fixture_frames")
            .select("*")
            .in("fixture_id", fixtureIds)
            .order("frame_number", { ascending: true });
          if (error) throw error;
          frameRows = data ?? [];
        }

        const framesByFixture = new Map<string, TournamentFrameScore[]>();
        frameRows.forEach((row) => {
          const list = framesByFixture.get(row.fixture_id) ?? [];
          list.push({
            frame_number: row.frame_number,
            score_a: row.score_a,
            score_b: row.score_b,
            winner: row.winner,
          });
          framesByFixture.set(row.fixture_id, list);
        });

        const fixturesByTournament = new Map<string, TournamentFixture[]>();
        (fixtureRows ?? []).forEach((row) => {
          const list = fixturesByTournament.get(row.tournament_id) ?? [];
          list.push({
            id: row.id,
            tournament_id: row.tournament_id,
            round_number: row.round_number,
            fixture_index: row.fixture_index,
            participant_a: row.participant_a,
            participant_b: row.participant_b,
            best_of_frames: row.best_of_frames,
            score_a: row.score_a ?? undefined,
            score_b: row.score_b ?? undefined,
            winner: row.winner ?? undefined,
            status: row.status,
            frame_scores: framesByFixture.get(row.id),
          });
          fixturesByTournament.set(row.tournament_id, list);
        });

        const tournaments = (tournamentRows ?? []).map((row) => mapTournamentRow(row, fixturesByTournament.get(row.id) ?? []));
        set({ tournaments });
      },
    }),
    {
      name: "tournaments-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 3,
      migrate: () => ({
        ownerUserId: null,
        tournaments: [],
      }),
    }
  )
);
