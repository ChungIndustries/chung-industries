import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy text to the clipboard, with a transient `copied` flag for the usual
 * checkmark feedback. Re-copying restarts the flag's timer, and the timer is
 * cleaned up on unmount.
 */
export function useCopyToClipboard(resetAfterMs = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), resetAfterMs);
      } catch {
        // Clipboard access denied; the text stays selectable by hand.
      }
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
