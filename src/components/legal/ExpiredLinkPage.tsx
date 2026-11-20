import { Link } from "@tanstack/react-router";

/**
 * 20 Nov 2026: the public page behind /r/<code>. A link of that shape is for one person's part of a proposal. This
 * page takes no props and reads nothing: not the code, not an account, not the database. Every code, real looking or
 * not, gets the same words, so nothing can be guessed from it.
 */
export const EXPIRED_LINK_COPY = {
  label: "Proposal link",
  heading: "This link is not active",
  body: "This link was made for one person's part of a proposal. It has expired, or it is not active yet.",
  next: "If someone asked for your help, ask them to send you a fresh link.",
  home: "Go to the Lasso home page",
} as const;

export function ExpiredLinkPage() {
  const copy = EXPIRED_LINK_COPY;
  return (
    <main className="min-h-screen bg-background px-6 py-16 md:px-12">
      <div className="mx-auto max-w-xl">
        <p className="micro-label text-(length:--type-label)">{copy.label}</p>
        <h1 className="page-title mt-2">{copy.heading}</h1>
        <p className="mt-4 text-sm leading-relaxed text-foreground">{copy.body}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.next}</p>
        <p className="mt-8 text-sm">
          <Link to="/" className="underline underline-offset-4 hover:text-foreground">
            {copy.home}
          </Link>
        </p>
      </div>
    </main>
  );
}
