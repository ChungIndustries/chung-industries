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
import { AlertCircle, BookOpen, FileQuestion, Package } from "lucide-react";
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

/* lucide-react dropped its brand icons, so the GitHub mark is inlined. */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.13-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 2.88-.39c.98 0 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

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
      <header className="border-border bg-background/75 sticky top-0 z-10 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <Link to="/" aria-label="cpm home">
            <span className="bg-brand text-background font-display rounded-sm px-1.5 pt-1 pb-0.5 text-sm leading-none">
              cpm
            </span>
          </Link>
          <nav className="flex gap-6 text-sm font-medium" aria-label="Site">
            <Link
              to="/packages"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              activeProps={{ className: "text-foreground" }}
            >
              <Package className="size-4" aria-hidden="true" />
              Packages
            </Link>
            <a
              href={DOCS_URL}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <BookOpen className="size-4" aria-hidden="true" />
              Docs
            </a>
            <a
              href={GITHUB_URL}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
            >
              <GithubIcon className="size-4" />
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
