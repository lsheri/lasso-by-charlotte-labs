import { Link } from "@tanstack/react-router";
import { FeedbackDialog } from "@/components/feedback/FeedbackWidget";
import { GraphiteIcon } from "@/components/notebook/icons";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { ResolvedNavItem } from "./nav-config";

/** The account destinations share labels, ordering and actions on every surface. */
export function WorkspaceMenuItems({ items, dropdown = false, onOpened, onSettings, onSignOut, onNavigate }: {
  items: ResolvedNavItem[];
  dropdown?: boolean;
  onOpened: (item: ResolvedNavItem["id"]) => void;
  onSettings: () => void;
  onSignOut: () => void;
  onNavigate?: (() => void) | undefined;
}) {
  return items.map((item) => {
    const content = <><GraphiteIcon name={item.icon} size={16} /><span>{item.label}</span></>;
    const activate = () => {
      onOpened(item.id);
      if (item.action === "openSettings") onSettings();
      else if (item.action === "signOut") onSignOut();
      if (item.action !== "openFeedback") onNavigate?.();
    };
    if (dropdown) {
      const row = item.to ? <DropdownMenuItem key={item.id} asChild>
        <Link to={item.to} data-nav-item={item.id} onClick={activate}>{content}</Link>
      </DropdownMenuItem> : <DropdownMenuItem key={item.id} data-nav-item={item.id}
        onSelect={(event) => { if (item.action === "openFeedback") event.preventDefault(); activate(); }}>{content}</DropdownMenuItem>;
      return item.action === "openFeedback" ? <FeedbackDialog key={item.id} trigger={row} /> : row;
    }
    const row = item.to ? <Link key={item.id} to={item.to} data-nav-item={item.id} className="nb-nav-item min-h-[48px]" onClick={activate}>{content}</Link>
      : <button key={item.id} type="button" data-nav-item={item.id} className="nb-nav-item min-h-[48px] w-full text-left" onClick={activate}>{content}</button>;
    return item.action === "openFeedback" ? <FeedbackDialog key={item.id} trigger={row} /> : row;
  });
}