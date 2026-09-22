jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

let mockServer: any[] = [];
let mockFail = false;
const mockUpsert = jest.fn(async () => ({ error: mockFail ? { message: "offline" } : null }));
const mockDelete = jest.fn(async () => ({ error: mockFail ? { message: "offline" } : null }));

jest.mock("../../api/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: mockServer, error: null }) }) }),
      upsert: (...args: unknown[]) => (mockUpsert as any)(...args),
      delete: () => ({ eq: () => ({ eq: (...args: unknown[]) => (mockDelete as any)(...args) }) }),
    }),
  },
}));

import { useCustomRoutinesStore } from "../customRoutinesStore";
import { coloursOnSpots } from "../../features/scanSnooker/position";

const store = () => useCustomRoutinesStore.getState();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mockServer = [];
  mockFail = false;
  mockUpsert.mockClear();
  mockDelete.mockClear();
  useCustomRoutinesStore.setState({ ownerId: "u1", routines: [], pending: {} });
});

describe("custom routines kept with the account", () => {
  it("shows a saved routine at once and sends it to the account", async () => {
    const routine = store().save({ name: "Line-up", description: null, maxScore: 15, balls: coloursOnSpots([]) });
    expect(store().routines[0].id).toBe(routine.id);
    await flush();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect((mockUpsert.mock.calls[0] as any)[0]).toMatchObject({
      id: routine.id,
      user_id: "u1",
      name: "Line-up",
      max_score: 15,
    });
    expect(store().pending).toEqual({});
  });

  it("keeps a routine made offline, and sends it when the account is next loaded", async () => {
    mockFail = true;
    const routine = store().save({ name: "Offline", description: null, maxScore: null, balls: [] });
    await flush();
    expect(store().pending[routine.id]).toBe("upsert");

    mockFail = false;
    await store().hydrate("u1"); // the account does not have it yet
    expect(store().routines.map((item) => item.id)).toContain(routine.id);
    expect(store().pending).toEqual({});
  });

  it("loads routines built on another device", async () => {
    mockServer = [
      {
        id: "r1",
        name: "From the tablet",
        description: null,
        max_score: null,
        balls: [],
        created_at: "2026-09-20T10:00:00Z",
        updated_at: "2026-09-20T10:00:00Z",
      },
    ];
    await store().hydrate("u1");
    expect(store().getById("r1")?.name).toBe("From the tablet");
  });

  it("deletes everywhere, and a delete made offline is not undone by the next load", async () => {
    mockServer = [
      {
        id: "r1",
        name: "Old",
        description: null,
        max_score: null,
        balls: [],
        created_at: "2026-09-20T10:00:00Z",
        updated_at: "2026-09-20T10:00:00Z",
      },
    ];
    await store().hydrate("u1");
    mockFail = true;
    store().remove("r1");
    await flush();
    expect(store().getById("r1")).toBeUndefined();
    mockFail = false;
    await store().hydrate("u1"); // the server still has it until the delete goes through
    expect(store().getById("r1")).toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
    expect(store().pending).toEqual({});
  });
});
