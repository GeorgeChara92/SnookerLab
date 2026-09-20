import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AppDialog, type DialogRequest } from "./AppDialog";

type ConfirmRequest = Omit<DialogRequest, "confirmLabel"> & { confirmLabel?: string };

/** A prompt with three real answers, e.g. draw at random, pair them myself, or not now. */
type ChoiceRequest = ConfirmRequest & { secondaryLabel: string; onSecondary: () => void };

type DialogApi = {
  /** A single-button message. */
  alert: (request: Omit<ConfirmRequest, "cancelLabel" | "onCancel">) => void;
  /** A two-button question. Defaults to Confirm / Cancel. */
  confirm: (request: ConfirmRequest) => void;
  /** A three-way choice, when folding it into two would drop an option. */
  choose: (request: ChoiceRequest) => void;
};

const DialogContext = createContext<DialogApi | null>(null);

/**
 * Hosts the app's dialog so screens can raise one without keeping their own state,
 * and so every prompt in the app looks and sounds the same.
 */
export const DialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      alert: (next) => setRequest({ confirmLabel: "OK", ...next }),
      confirm: (next) => setRequest({ confirmLabel: "Confirm", cancelLabel: "Cancel", ...next }),
      choose: (next) => setRequest({ confirmLabel: "Confirm", cancelLabel: "Cancel", ...next }),
    }),
    []
  );

  const dismiss = useCallback(() => setRequest(null), []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <AppDialog
        visible={request !== null}
        {...(request ?? { title: "", confirmLabel: "OK" })}
        onDismiss={dismiss}
      />
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogApi => {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialog must be used inside DialogProvider");
  return context;
};
