import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { AlertCircle, FileQuestion } from "lucide-react";
import type { ReactNode } from "react";

import { DOCS_URL, GITHUB_URL, SITE_ORIGIN } from "@/site";

import appCss from "@/styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

const DESCRIPTION =
  "cpm is the package manager for ComputerCraft: install Lua packages, programs, and their dependencies on CC:Tweaked computers with one in-game command.";

export const Route = createRootRouteWithContext<RouterContext>()({
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
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#17191e" },
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
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-background/90 sticky top-0 z-10 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="cpm home">
            <span className="bg-brand text-screen font-display rounded-sm px-1.5 pt-1 pb-0.5 text-sm leading-none">
              cpm
            </span>
            <span className="text-muted-foreground hidden text-sm sm:inline">
              the ComputerCraft package manager
            </span>
          </Link>
          <nav className="flex gap-6 text-sm font-medium" aria-label="Site">
            <Link
              to="/packages"
              className="text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Packages
            </Link>
            <a href={DOCS_URL} className="text-muted-foreground hover:text-foreground">
              Docs
            </a>
            <a href={GITHUB_URL} className="text-muted-foreground hover:text-foreground">
              GitHub
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-4 px-6 py-7 text-sm">
          <span>
            <a href="https://chungindustries.com" className="hover:text-foreground">
              ChungIndustries
            </a>
            : recreating the internet inside Minecraft
          </span>
          <span>
            <a href={DOCS_URL} className="hover:text-foreground">
              registry API
            </a>{" "}
            ·{" "}
            <a href={GITHUB_URL} className="hover:text-foreground">
              source
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>404</EmptyTitle>
          <EmptyDescription>This page does not exist.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/packages">Browse packages</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function ErrorBoundary({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>
            {import.meta.env.DEV ? error.message : "The registry is not answering right now."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-3">
            <Button onClick={() => router.invalidate()}>Try again</Button>
            <Button variant="outline" asChild>
              <Link to="/">Go home</Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
