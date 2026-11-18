// The icon swap layer (18 Nov 2026, design guardrail; Liam chose "icons via a swap layer"). Every icon the app draws
// is imported from here, never from lucide-react, so a brand can replace any icon in this one file. Each export keeps its
// Lucide name and props; it asks the brand for its icon set and renders Lucide unless that set overrides the name.
// Charlotte and Lasso both use Lucide as their base set, so nothing on screen changes. Adding an icon: import it from
// lucide-react below and wrap it with brandIcon.
import { forwardRef, type ElementRef } from "react";
import {
  ArrowLeft as LucideArrowLeft,
  ArrowRight as LucideArrowRight,
  ArrowUp as LucideArrowUp,
  ArrowUpRight as LucideArrowUpRight,
  Bell as LucideBell,
  Bold as LucideBold,
  BookOpen as LucideBookOpen,
  Bot as LucideBot,
  Check as LucideCheck,
  CheckCircle2 as LucideCheckCircle2,
  ChevronDown as LucideChevronDown,
  ChevronDownIcon as LucideChevronDownIcon,
  ChevronLeft as LucideChevronLeft,
  ChevronLeftIcon as LucideChevronLeftIcon,
  ChevronRight as LucideChevronRight,
  ChevronRightIcon as LucideChevronRightIcon,
  ChevronUp as LucideChevronUp,
  ChevronsDownUp as LucideChevronsDownUp,
  ChevronsUpDown as LucideChevronsUpDown,
  Circle as LucideCircle,
  CircleDashed as LucideCircleDashed,
  Code2 as LucideCode2,
  Download as LucideDownload,
  ExternalLink as LucideExternalLink,
  Eye as LucideEye,
  File as LucideFile,
  FileText as LucideFileText,
  Folder as LucideFolder,
  GripVertical as LucideGripVertical,
  Hand as LucideHand,
  HardDrive as LucideHardDrive,
  Heading2 as LucideHeading2,
  History as LucideHistory,
  Image as LucideImage,
  Info as LucideInfo,
  Italic as LucideItalic,
  Link2 as LucideLink2,
  List as LucideList,
  ListOrdered as LucideListOrdered,
  Loader2 as LucideLoader2,
  LoaderCircle as LucideLoaderCircle,
  Lock as LucideLock,
  Mail as LucideMail,
  Maximize2 as LucideMaximize2,
  Menu as LucideMenu,
  MessageSquare as LucideMessageSquare,
  MessagesSquare as LucideMessagesSquare,
  Mic as LucideMic,
  Minimize2 as LucideMinimize2,
  Minus as LucideMinus,
  MoreHorizontal as LucideMoreHorizontal,
  PanelLeft as LucidePanelLeft,
  Paperclip as LucidePaperclip,
  Pencil as LucidePencil,
  Phone as LucidePhone,
  Pin as LucidePin,
  Plus as LucidePlus,
  Presentation as LucidePresentation,
  Quote as LucideQuote,
  RemoveFormatting as LucideRemoveFormatting,
  Search as LucideSearch,
  Sparkle as LucideSparkle,
  Sparkles as LucideSparkles,
  Strikethrough as LucideStrikethrough,
  Table2 as LucideTable2,
  Trash2 as LucideTrash2,
  Underline as LucideUnderline,
  Video as LucideVideo,
  X as LucideX,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

import { useBrand } from "@/components/skin/use-skin";
import type { BrandLook } from "@/design/brand/brand";

export type { LucideIcon, LucideProps };

/** The names this layer draws. A brand's icon set may override any of them. */
export type BrandIconName =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowUpRight"
  | "Bell"
  | "Bold"
  | "BookOpen"
  | "Bot"
  | "Check"
  | "CheckCircle2"
  | "ChevronDown"
  | "ChevronDownIcon"
  | "ChevronLeft"
  | "ChevronLeftIcon"
  | "ChevronRight"
  | "ChevronRightIcon"
  | "ChevronUp"
  | "ChevronsDownUp"
  | "ChevronsUpDown"
  | "Circle"
  | "CircleDashed"
  | "Code2"
  | "Download"
  | "ExternalLink"
  | "Eye"
  | "File"
  | "FileText"
  | "Folder"
  | "GripVertical"
  | "Hand"
  | "HardDrive"
  | "Heading2"
  | "History"
  | "Image"
  | "Info"
  | "Italic"
  | "Link2"
  | "List"
  | "ListOrdered"
  | "Loader2"
  | "LoaderCircle"
  | "Lock"
  | "Mail"
  | "Maximize2"
  | "Menu"
  | "MessageSquare"
  | "MessagesSquare"
  | "Mic"
  | "Minimize2"
  | "Minus"
  | "MoreHorizontal"
  | "PanelLeft"
  | "Paperclip"
  | "Pencil"
  | "Phone"
  | "Pin"
  | "Plus"
  | "Presentation"
  | "Quote"
  | "RemoveFormatting"
  | "Search"
  | "Sparkle"
  | "Sparkles"
  | "Strikethrough"
  | "Table2"
  | "Trash2"
  | "Underline"
  | "Video"
  | "X";

/**
 * Icon sets by name. Lucide is the base set and overrides nothing. A new brand adds its set here, maps the names it
 * redraws to its own components (any component that takes Lucide's props), and names the set in its look.
 */
export const ICON_SETS: Record<BrandLook["icons"], Partial<Record<BrandIconName, LucideIcon>>> = {
  lucide: {},
};

/** Wraps a Lucide icon so the brand's set can replace it; renders Lucide itself when the set does not. */
export function brandIcon(name: BrandIconName, Base: LucideIcon): LucideIcon {
  const Branded = forwardRef<ElementRef<LucideIcon>, LucideProps>(function Branded(props, ref) {
    const Drawn = ICON_SETS[useBrand().look.icons][name] ?? Base;
    return <Drawn ref={ref} {...props} />;
  });
  Branded.displayName = name;
  return Branded as LucideIcon;
}

export const ArrowLeft = brandIcon("ArrowLeft", LucideArrowLeft);
export const ArrowRight = brandIcon("ArrowRight", LucideArrowRight);
export const ArrowUp = brandIcon("ArrowUp", LucideArrowUp);
export const ArrowUpRight = brandIcon("ArrowUpRight", LucideArrowUpRight);
export const Bell = brandIcon("Bell", LucideBell);
export const Bold = brandIcon("Bold", LucideBold);
export const BookOpen = brandIcon("BookOpen", LucideBookOpen);
export const Bot = brandIcon("Bot", LucideBot);
export const Check = brandIcon("Check", LucideCheck);
export const CheckCircle2 = brandIcon("CheckCircle2", LucideCheckCircle2);
export const ChevronDown = brandIcon("ChevronDown", LucideChevronDown);
export const ChevronDownIcon = brandIcon("ChevronDownIcon", LucideChevronDownIcon);
export const ChevronLeft = brandIcon("ChevronLeft", LucideChevronLeft);
export const ChevronLeftIcon = brandIcon("ChevronLeftIcon", LucideChevronLeftIcon);
export const ChevronRight = brandIcon("ChevronRight", LucideChevronRight);
export const ChevronRightIcon = brandIcon("ChevronRightIcon", LucideChevronRightIcon);
export const ChevronUp = brandIcon("ChevronUp", LucideChevronUp);
export const ChevronsDownUp = brandIcon("ChevronsDownUp", LucideChevronsDownUp);
export const ChevronsUpDown = brandIcon("ChevronsUpDown", LucideChevronsUpDown);
export const Circle = brandIcon("Circle", LucideCircle);
export const CircleDashed = brandIcon("CircleDashed", LucideCircleDashed);
export const Code2 = brandIcon("Code2", LucideCode2);
export const Download = brandIcon("Download", LucideDownload);
export const ExternalLink = brandIcon("ExternalLink", LucideExternalLink);
export const Eye = brandIcon("Eye", LucideEye);
export const File = brandIcon("File", LucideFile);
export const FileText = brandIcon("FileText", LucideFileText);
export const Folder = brandIcon("Folder", LucideFolder);
export const GripVertical = brandIcon("GripVertical", LucideGripVertical);
export const Hand = brandIcon("Hand", LucideHand);
export const HardDrive = brandIcon("HardDrive", LucideHardDrive);
export const Heading2 = brandIcon("Heading2", LucideHeading2);
export const History = brandIcon("History", LucideHistory);
export const Image = brandIcon("Image", LucideImage);
export const Info = brandIcon("Info", LucideInfo);
export const Italic = brandIcon("Italic", LucideItalic);
export const Link2 = brandIcon("Link2", LucideLink2);
export const List = brandIcon("List", LucideList);
export const ListOrdered = brandIcon("ListOrdered", LucideListOrdered);
export const Loader2 = brandIcon("Loader2", LucideLoader2);
export const LoaderCircle = brandIcon("LoaderCircle", LucideLoaderCircle);
export const Lock = brandIcon("Lock", LucideLock);
export const Mail = brandIcon("Mail", LucideMail);
export const Maximize2 = brandIcon("Maximize2", LucideMaximize2);
export const Menu = brandIcon("Menu", LucideMenu);
export const MessageSquare = brandIcon("MessageSquare", LucideMessageSquare);
export const MessagesSquare = brandIcon("MessagesSquare", LucideMessagesSquare);
export const Mic = brandIcon("Mic", LucideMic);
export const Minimize2 = brandIcon("Minimize2", LucideMinimize2);
export const Minus = brandIcon("Minus", LucideMinus);
export const MoreHorizontal = brandIcon("MoreHorizontal", LucideMoreHorizontal);
export const PanelLeft = brandIcon("PanelLeft", LucidePanelLeft);
export const Paperclip = brandIcon("Paperclip", LucidePaperclip);
export const Pencil = brandIcon("Pencil", LucidePencil);
export const Phone = brandIcon("Phone", LucidePhone);
export const Pin = brandIcon("Pin", LucidePin);
export const Plus = brandIcon("Plus", LucidePlus);
export const Presentation = brandIcon("Presentation", LucidePresentation);
export const Quote = brandIcon("Quote", LucideQuote);
export const RemoveFormatting = brandIcon("RemoveFormatting", LucideRemoveFormatting);
export const Search = brandIcon("Search", LucideSearch);
export const Sparkle = brandIcon("Sparkle", LucideSparkle);
export const Sparkles = brandIcon("Sparkles", LucideSparkles);
export const Strikethrough = brandIcon("Strikethrough", LucideStrikethrough);
export const Table2 = brandIcon("Table2", LucideTable2);
export const Trash2 = brandIcon("Trash2", LucideTrash2);
export const Underline = brandIcon("Underline", LucideUnderline);
export const Video = brandIcon("Video", LucideVideo);
export const X = brandIcon("X", LucideX);
