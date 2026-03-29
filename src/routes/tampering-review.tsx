import { createFileRoute } from "@tanstack/react-router";
import { TamperingReviewPage } from "../pages/tampering-review/TamperingReviewPage";

export const Route = createFileRoute("/tampering-review")({
  component: TamperingReviewPage,
});
