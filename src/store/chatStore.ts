import { create } from "zustand";
import { fetchInbox, groupsFor, profilesFor, type Group, type InboxRow } from "../features/community/chat";
import type { PublicProfile } from "../features/community/types";

/**
 * The player's inbox: their chats and message requests, with the people and groups they are
 * with and what is unread. Refreshed on sign in, when a chat changes, and when a screen asks.
 */

type ChatState = {
  ownerId: string | null;
  inbox: InboxRow[];
  profiles: Record<string, PublicProfile>;
  groups: Record<string, Group>;
  loaded: boolean;
  setOwner: (userId: string | null) => void;
  refresh: () => Promise<void>;
  /** Clears a conversation's unread count at once, before the database catches up. */
  markSeen: (conversationId: string) => void;
};

export const useChatStore = create<ChatState>()((set, get) => ({
  ownerId: null,
  inbox: [],
  profiles: {},
  groups: {},
  loaded: false,

  setOwner: (userId) => {
    if (get().ownerId === userId) return;
    set({ ownerId: userId, inbox: [], profiles: {}, groups: {}, loaded: false });
  },

  refresh: async () => {
    const owner = get().ownerId;
    if (!owner) return;
    const rows = await fetchInbox();
    if (!rows || get().ownerId !== owner) return;
    const [profiles, groups] = await Promise.all([
      profilesFor(rows.map((row) => row.otherUser ?? "").filter(Boolean)),
      groupsFor(rows.map((row) => row.groupId ?? "").filter(Boolean)),
    ]);
    if (get().ownerId !== owner) return;
    set((state) => ({
      inbox: rows,
      profiles: { ...state.profiles, ...profiles },
      groups: { ...state.groups, ...groups },
      loaded: true,
    }));
  },

  markSeen: (conversationId) =>
    set((state) => ({
      inbox: state.inbox.map((row) => (row.conversationId === conversationId ? { ...row, unread: 0 } : row)),
    })),
}));

/** Unread direct chats (muted ones left out) and waiting requests, for badges. Groups are left out
 * of the count the same way ChatsScreen leaves them out of the list - a badge for something that
 * would not actually be there when you tap it is worse than no badge. */
export const useChatBadges = () =>
  useChatStore((state) => {
    let unread = 0;
    let requests = 0;
    state.inbox.forEach((row) => {
      if (row.kind !== "direct") return;
      if (row.status === "request") requests += 1;
      else if (!row.muted && row.unread > 0) unread += 1;
    });
    return unread * 1000 + requests;
  });

export const splitBadges = (packed: number) => ({ unread: Math.floor(packed / 1000), requests: packed % 1000 });
