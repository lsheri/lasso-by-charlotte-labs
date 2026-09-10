import { createContext, useContext, useState, type ReactNode } from "react";

type SettingsCtx = {
  open: boolean;
  openSettings: () => void;
  closeSettings: () => void;
};

const SettingsCtx = createContext<SettingsCtx | null>(null);

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsCtx.Provider
      value={{
        open,
        openSettings: () => setOpen(true),
        closeSettings: () => setOpen(false),
      }}
    >
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettingsDialog() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettingsDialog must be used inside SettingsDialogProvider");
  return ctx;
}
