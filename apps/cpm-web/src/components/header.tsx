import { Link } from "@tanstack/react-router";
import { BookOpen, Package } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { GithubIcon } from "@/components/icons";
import { DOCS_URL, GITHUB_URL } from "@/site";

export function SiteHeader() {
  return (
    <header className="border-border bg-background/75 sticky top-0 z-10 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
        <Link to="/" aria-label="cpm home" className="flex items-center gap-2">
          <BrandMark />
          <span className="text-muted-foreground text-sm">by ChungIndustries</span>
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
  );
}
