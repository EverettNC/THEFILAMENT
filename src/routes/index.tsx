import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FilamentEar } from "@/components/filament/filament-ear";
import { FilamentStage, type FilamentView } from "@/components/filament/filament-stage";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [view, setView] = useState<FilamentView>("housing");
  return (
    <>
      <FilamentStage view={view} />
      <FilamentEar view={view} onView={setView} />
    </>
  );
}
