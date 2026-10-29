import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { FACE_WORD, type CardFace } from "@/design/reference/FaceToggle";

/** Overflow access to the same board-wide face choice as the row toggle. */
export function BoardCardFaceMenu({ value, onChange }: { value: CardFace; onChange: (face: CardFace) => void }) {
  return <>
    <DropdownMenuLabel>Show work as</DropdownMenuLabel>
    <DropdownMenuRadioGroup value={value} aria-label="Show work as">
      <DropdownMenuRadioItem value="art" onSelect={() => onChange("art")}>{FACE_WORD.art}</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="preview" onSelect={() => onChange("preview")}>{FACE_WORD.preview}</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </>;
}