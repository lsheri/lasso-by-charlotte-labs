import { Navigate, createFileRoute } from "@tanstack/react-router";
import type React from "react";

import { useProfile } from "@/hooks/use-profile";
import { QA_SEED_ORG_ID } from "@/lib/qa-seed.functions";

import { MotionPage } from "@/pages/MotionPage";

export const Route = createFileRoute("/_authenticated/motion")({
  head: () => ({
    meta: [
      { title: "Motion | Lasso" },
      {
        name: "description",
        content: "The animated scenes in the app, and where each one renders.",
      },
      { property: "og:title", content: "Motion | Lasso" },
      {
        property: "og:description",
        content: "The animated scenes in the app, and where each one renders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MotionRoute,
});

function MotionRoute() {
  return (
    <FounderAdminOnly>
      <MotionPage />
    </FounderAdminOnly>
  );
}

function FounderAdminOnly({ children }: { children: React.ReactNode }) {
  const { data: profile, isPending } = useProfile();
  if (isPending) return null;
  const allowed = profile?.role === "admin" && profile?.org_id === QA_SEED_ORG_ID;
  if (!allowed) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

