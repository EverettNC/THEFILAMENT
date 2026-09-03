import { createFileRoute } from "@tanstack/react-router";
import { FilamentApp } from "@/components/filament-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FilamentApp />;
}
