import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Three tones, matching the design system's Toast component.
 *
 * neutral is an ink chip with paper text, and it is the reason there is no
 * shadow here: a dark chip separates from paper on its own. record and danger
 * are light washes with a 1px border in their own ink.
 *
 * Colour lives only on the per-type keys, never on the shared `toast` key, so
 * a type never has to out-specify the base. The `group-[.toaster]:` prefix is
 * what wins against sonner's own stylesheet; keep it on every visual class.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-md group-[.toaster]:border group-[.toaster]:text-[13px] group-[.toaster]:font-medium",
          default:
            "group-[.toaster]:border-ink group-[.toaster]:bg-ink group-[.toaster]:text-nb-white",
          success:
            "group-[.toaster]:border-green group-[.toaster]:bg-[var(--nb-green-wash)] group-[.toaster]:text-green",
          error:
            "group-[.toaster]:border-[var(--nb-ink-ember)] group-[.toaster]:bg-[var(--nb-ink-ember-wash)] group-[.toaster]:text-[var(--nb-ink-ember)]",
          description: "group-[.toast]:text-current group-[.toast]:opacity-80",
          actionButton:
            "group-[.toast]:border group-[.toast]:border-current group-[.toast]:bg-nb-white group-[.toast]:text-ink",
          cancelButton: "group-[.toast]:bg-transparent group-[.toast]:text-current",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
