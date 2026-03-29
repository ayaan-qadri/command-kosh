import { createFileRoute } from "@tanstack/react-router";
import { CommandListPage } from "../pages/command-list/CommandListPage";

export const Route = createFileRoute("/")({
  component: CommandListPage,
});
