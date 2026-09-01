import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { sessionQueryOptions } from "@/auth/queries";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { NotFound } from "@/components/not-found";
import { SITE_ORIGIN } from "@/site";

import appCss from "@/styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

const DESCRIPTION =
  "cpm is the package manager for ComputerCraft: install Lua packages, programs, and their dependencies on CC:Tweaked computers with one in-game command.";

export const Route = createRootRouteWithContext<RouterContext>()({
  // The header's account slot needs the session everywhere; cached with a
  // short staleTime, so this only actually fetches once a minute at most. A
  // failed lookup renders the site signed out rather than broken.
  beforeLoad: async ({ context }) => {
    await context.queryClient.ensureQueryData(sessionQueryOptions).catch(() => null);
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "cpm | The ComputerCraft Package Manager" },
      { name: "description", content: DESCRIPTION },
      { property: "og:site_name", content: "cpm" },
      { property: "og:title", content: "cpm | The ComputerCraft Package Manager" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_ORIGIN },
      { property: "og:image", content: `${SITE_ORIGIN}/og.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "cpm, the package manager for ComputerCraft, with a terminal installing it",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0f0f0f" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Silkscreen&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
