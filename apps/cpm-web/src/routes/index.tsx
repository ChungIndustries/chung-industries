import { createFileRoute } from "@tanstack/react-router";

import { CommandsSection } from "@/landing-page/components/commands-section";
import { GetStartedSection } from "@/landing-page/components/get-started-section";
import { Hero } from "@/landing-page/components/hero";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <Hero />
      <GetStartedSection />
      <CommandsSection />
    </>
  );
}
