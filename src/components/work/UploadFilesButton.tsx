import { useRef } from "react";

import { BrandLogo } from "@/components/connectors/BrandLogo";
import { Button } from "@/components/ui/button";
import { WorkingLabel } from "@/components/common/Working";
import { useCaptureFiles } from "@/components/work/use-capture-files";

export function UploadFilesButton({
  variant = "outline",
  label = "Upload files",
  onCaptured,
}: {
  variant?: "default" | "outline";
  label?: string;
  onCaptured?: ((workItemIds: string[]) => void | Promise<void>) | undefined;
}) {
  const { capture, pending, progress, error } = useCaptureFiles();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const capturedIds = await capture(Array.from(files));
    if (capturedIds.length > 0 && onCaptured) await onCaptured(capturedIds);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        className="gap-2"
        onClick={() => inputRef.current?.click()}
      >
        {pending ? null : <BrandLogo brand="upload" size={17} />}
        {pending ? (
          <WorkingLabel>
            {progress && progress.total > 1
              ? `Uploading ${progress.done + 1} of ${progress.total}`
              : "Uploading"}
          </WorkingLabel>
        ) : (
          label
        )}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
