import { useSessionContext } from "../contexts/sessionContextStore";

export const useKeystrokeLogger = () => {
  const {
    keystrokes,
    handleKeyDown,
    handleKeyUp,
    logPaste,
    logTextChange,
    flushKeystrokes,
    scheduleSync,
  } = useSessionContext();

  return {
    keystrokes,
    handleKeyDown,
    handleKeyUp,
    logPaste,
    logTextChange,
    flushKeystrokes,
    scheduleSync,
  };
};
