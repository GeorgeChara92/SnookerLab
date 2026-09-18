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
import { dateKeyFrom, todayKey } from "../utils/date";

type CreateTournamentInput = {
  name: string;
  tournamentType: TournamentType;
  entryMode: TournamentEntryMode;
  pairingMode: TournamentPairingMode;
  bestOfFrames: number;
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

const buildLeagueFixtures = (tournamentId: string, participants: string[], bestOfFrames: number) => {
  const list = participants.filter((name) => !isBye(name));
  const fixtures: TournamentFixture[] = [];
  let fixtureIndex = 0;

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      fixtures.push({
        id: makeId(),
        tournament_id: tournamentId,
        round_number: 1,
        fixture_index: fixtureIndex,
        participant_a: list[i],
        participant_b: list[j],
        best_of_frames: Math.max(1, bestOfFrames),
        status: "pending",
      });
      fixtureIndex += 1;
    }
  }

  return fixtures;
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
            : buildLeagueFixtures(makeId(), participants, input.bestOfFrames);

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

        const updated = tournament.fixtures.map((fixture) => {
          if (fixture.id !== fixtureId) return { ...fixture };
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

        const fixtureUpdates = fixtures.map((fixture) =>
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
        );

        await Promise.all(fixtureUpdates);

        const frameDeleteUpdates = fixtures.map((fixture) =>
          supabase.from("tournament_fixture_frames").delete().eq("fixture_id", fixture.id)
        );
        await Promise.all(frameDeleteUpdates);

        const framePayload = fixtures.flatMap((fixture) =>
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

        await supabase
          .from("tournaments")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", tournamentId);

        set((state) => ({
          tournaments: state.tournaments.map((item) =>
            item.id === tournamentId
              ? {
                  ...item,
                  fixtures,
                  status,
                  updated_at: new Date().toISOString(),
                }
              : item
          ),
        }));
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
