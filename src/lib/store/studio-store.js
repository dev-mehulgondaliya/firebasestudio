"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "@/lib/api/client";

// Client-side UI state shared across Studio pages. Only non-sensitive
// preferences are persisted (to localStorage); connection credentials never
// reach the browser.

export const useStudioStore = create(
  persist(
    (set, get) => ({
      hydrated: false,

      activeConnectionId: null,
      setActiveConnectionId: (activeConnectionId) => set({ activeConnectionId }),

      // Web SDK connections cannot list root collections, so remember the ones
      // the user has opened, per connection.
      knownCollections: {},
      addKnownCollection: (connectionId, path) =>
        set((state) => {
          const current = state.knownCollections[connectionId] || [];
          if (current.includes(path)) return state;
          return { knownCollections: { ...state.knownCollections, [connectionId]: [...current, path].sort() } };
        }),
      removeKnownCollection: (connectionId, path) =>
        set((state) => ({
          knownCollections: {
            ...state.knownCollections,
            [connectionId]: (state.knownCollections[connectionId] || []).filter((item) => item !== path),
          },
        })),

      connections: [],
      connectionsStatus: "idle", // idle | loading | ready | error
      connectionsError: null,
      loadConnections: async ({ force = false } = {}) => {
        const { connectionsStatus } = get();
        if (!force && (connectionsStatus === "loading" || connectionsStatus === "ready")) return get().connections;
        set({ connectionsStatus: "loading", connectionsError: null });
        try {
          const { connections } = await api("/api/connections");
          const { activeConnectionId } = get();
          const stillExists = connections.some((connection) => connection.id === activeConnectionId);
          set({
            connections,
            connectionsStatus: "ready",
            activeConnectionId: stillExists ? activeConnectionId : connections[0]?.id ?? null,
          });
          return connections;
        } catch (error) {
          set({ connectionsStatus: "error", connectionsError: error.message });
          return [];
        }
      },

      toasts: [],
      toast: (message, tone = "info") => {
        const id = Math.random().toString(36).slice(2);
        set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
        setTimeout(() => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), tone === "error" ? 7000 : 3500);
      },
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    }),
    {
      name: "firebase-studio-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeConnectionId: state.activeConnectionId, knownCollections: state.knownCollections }),
      skipHydration: true,
      onRehydrateStorage: () => () => useStudioStore.setState({ hydrated: true }),
    },
  ),
);

export function useActiveConnection() {
  return useStudioStore((state) => state.connections.find((connection) => connection.id === state.activeConnectionId) || null);
}

export const toast = (message, tone) => useStudioStore.getState().toast(message, tone);
