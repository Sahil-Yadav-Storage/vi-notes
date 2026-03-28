export interface Keystroke {
  action: "down" | "up" | "paste" | "edit";
  rawTimestamp?: number;
  timestamp: number;
  rawDuration?: number;
  duration?: number;
  pasteLength?: number;
  pasteSelectionStart?: number;
  pasteSelectionEnd?: number;
  editedLater?: boolean;
  editStart?: number;
  editEnd?: number;
  insertedLength?: number;
  removedLength?: number;
}
