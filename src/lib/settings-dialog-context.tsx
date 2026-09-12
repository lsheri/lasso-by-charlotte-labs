import { createContext, useContext, useState, type ReactNode } from "react";

/** Where the person came from when they opened settings. */
export type SettingsOpenFrom = "settings_rail" | "connect_sheet" | "deep_link";

type SettingsCtx = {
  open: boolean;
  /** Which section to land on, when the caller named one. */
  section: string | undefined;
  /** True when the caller named a section, false when settings was opened bare. */
  openedWithSection: boolean;
  /** Set only by callers that know their own entry point. */
  openedFrom: SettingsOpenFrom | undefined;
  openSettings: (sectionId?: string, from?: SettingsOpenFrom) => void;
  closeSettings: () => void;
};

const SettingsCtx = createContext<SettingsCtx | null>(null);

export function SettingsDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | undefined>(undefined);
  const [openedWithSection, setOpenedWithSection] = useState(false);
  const [openedFrom, setOpenedFrom] = useState<SettingsOpenFrom | undefined>(undefined);
  return (
    <SettingsCtx.Provider
      value={{
        open,
        section,
        openedWithSection,
        openedFrom,
        openSettings: (sectionId?: string, from?: SettingsOpenFrom) => {
          setSection(sectionId);
          setOpenedWithSection(Boolean(sectionId));
          setOpenedFrom(from);
          setOpen(true);
        },
        closeSettings: () => {
          setSection(undefined);
          setOpenedWithSection(false);
          setOpenedFrom(undefined);
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
