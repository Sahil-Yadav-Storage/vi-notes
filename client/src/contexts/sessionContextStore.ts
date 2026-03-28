import { createContext, useContext } from "react";
import type { Keystroke } from "@shared/keystroke";

export type SessionStatus = "idle" | "active" | "closing" | "closed";

export type SessionContextValue = {
  sessionId: string | null;
  sessionStatus: SessionStatus;
  keystrokes: Keystroke[];
  lastSyncError: string | null;
  clearLastSyncError: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleKeyUp: (e: React.KeyboardEvent) => void;
  logPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  logTextChange: (before: string, after: string) => void;
  flushKeystrokes: () => Keystroke[];
  scheduleSync: () => void;
};

export const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export const useSessionContext = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSessionContext must be used within a SessionProvider.");
  }

  return context;
};
