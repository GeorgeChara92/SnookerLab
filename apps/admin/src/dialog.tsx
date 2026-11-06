import { createContext, useContext, useEffect, useRef, useState } from "react";

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger";
  /** When set, the confirm button stays off until this exact text is typed. */
  requireText?: string;
  onConfirm: () => void;
};
type AlertRequest = { title: string; message: string };
type DialogApi = { confirm: (request: ConfirmRequest) => void; alert: (request: AlertRequest) => void };

const DialogContext = createContext<DialogApi>({ confirm: () => undefined, alert: () => undefined });

export const useDialog = () => useContext(DialogContext);

/** Confirm and alert in the dashboard's own look, instead of the browser's. Escape cancels. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [alertReq, setAlertReq] = useState<AlertRequest | null>(null);
  const [typed, setTyped] = useState("");
  const api = useRef<DialogApi>({ confirm: setConfirmReq, alert: setAlertReq }).current;
  const open = confirmReq || alertReq;

  useEffect(() => setTyped(""), [confirmReq]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmReq(null);
        setAlertReq(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {confirmReq ? (
        <div className="overlay">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <h2 id="dialog-title">{confirmReq.title}</h2>
            <p className="muted">{confirmReq.message}</p>
            {confirmReq.requireText ? (
              <label className="field">
                <span>
                  Type <strong>{confirmReq.requireText}</strong> to confirm
                </span>
                <input autoFocus value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} />
              </label>
            ) : null}
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setConfirmReq(null)}>
                Cancel
              </button>
              <button
                type="button"
                autoFocus={!confirmReq.requireText}
                disabled={Boolean(confirmReq.requireText) && typed.trim() !== confirmReq.requireText}
                className={confirmReq.tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
                onClick={() => {
                  confirmReq.onConfirm();
                  setConfirmReq(null);
                }}
              >
                {confirmReq.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {alertReq ? (
        <div className="overlay">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
            <h2 id="alert-title">{alertReq.title}</h2>
            <p className="muted">{alertReq.message}</p>
            <div className="row-actions">
              <button type="button" autoFocus className="btn btn-primary" onClick={() => setAlertReq(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}
