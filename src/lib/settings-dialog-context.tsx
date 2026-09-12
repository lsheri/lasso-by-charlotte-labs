import { createContext, useContext, useState, type ReactNode } from "react";

type SettingsCtx = {
  open: boolean;
  /** Which section to land on, when the caller named one. */
  section: string | undefined;
  openSettings: (sectionId?: string) => void;
  closeSettings: () => void;
};

const SettingsCtx = createContext<SettingsCtx | null>(null);

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | undefined>(undefined);
  return (
    <SettingsCtx.Provider
      value={{
        open,
        section,
        openSettings: (sectionId?: string) => {
          setSection(sectionId);
          setOpen(true);
        },
        closeSettings: () => {
          setSection(undefined);
          setOpen(false);
        },
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

/** Same context, but tolerant of being rendered outside the provider. */
export function useSettingsDialogOptional(): SettingsCtx | null {
  return useContext(SettingsCtx);
}
