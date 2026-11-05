import React, { useState } from "react";
import { FoulSheet } from "./FoulSheet";
import { foulTargetFor } from "../../features/matches/foulBridge";
import type { LiveFoulType } from "../../features/matches/liveFrameEngine";

/**
 * The foul sheet for a scan screen: the same one as live scoring, adding to the same frame. It
 * starts on "Foul and a miss", since putting the balls back is what the scan is open for.
 */
export const useScanFoul = (matchId: string, frameNumber: number) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<4 | 5 | 6 | 7>(4);
  const [type, setType] = useState<LiveFoulType>("foul_and_miss");
  const [note, setNote] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const target = foulTargetFor(matchId, frameNumber);

  const start = () => {
    if (!target) return;
    setValue(target.minimum());
    setType("foul_and_miss");
    setNote("");
    setOpen(true);
  };

  const apply = () => {
    if (target) setAdded(target.apply(value, type, note.trim() || undefined));
    setOpen(false);
  };

  const sheet = target ? (
    <FoulSheet
      visible={open}
      minimumValue={target.minimum()}
      value={value}
      onValueChange={setValue}
      foulType={type}
      onFoulTypeChange={setType}
      note={note}
      onNoteChange={setNote}
      awardedTo={target.awardedTo()}
      onApply={apply}
      onCancel={() => setOpen(false)}
    />
  ) : null;

  return { available: Boolean(target), label: added ? `Added: ${added}` : "Add a foul", start, sheet };
};
