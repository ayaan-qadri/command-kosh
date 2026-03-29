import { createFileRoute } from "@tanstack/react-router";
import { CommandDetailsPage } from "../pages/command-details/CommandDetailsPage";

export const Route = createFileRoute("/command-details/$commandId")({
  component: CommandDetailsPage,
});
