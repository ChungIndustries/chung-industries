import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useRouter } from "@tanstack/react-router";
import { AlertCircle, FileQuestion } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";

import { DOCS_URL, GITHUB_URL } from "@/site";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorBoundary,
});

function RootComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-4 px-6">
          <Link to="/" className="flex items-baseline font-display text-xl text-primary">
            cpm
            <span
              className="ml-0.5 inline-block h-4 w-2.5 animate-blink self-center bg-primary motion-reduce:animate-none"
              aria-hidden="true"
            />
          </Link>
          <nav className="flex gap-6 text-sm" aria-label="Site">
            <Link
              to="/packages"
              className="text-muted-foreground hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              packages
            </Link>
            <a href={DOCS_URL} className="text-muted-foreground hover:text-primary">
              api docs
            </a>
            <a href={GITHUB_URL} className="text-muted-foreground hover:text-primary">
              github
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-4 px-6 py-7 text-sm text-muted-foreground">
          <span>
            <a href="https://chungindustries.com" className="hover:text-primary">
              ChungIndustries
            </a>
            : recreating the internet inside Minecraft
          </span>
          <span>
            <a href={DOCS_URL} className="hover:text-primary">
              registry API
            </a>{" "}
            ·{" "}
            <a href={GITHUB_URL} className="hover:text-primary">
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
          <EmptyTitle className="font-display">404</EmptyTitle>
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
