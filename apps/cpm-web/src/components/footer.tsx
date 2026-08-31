import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { DOCS_URL, GITHUB_URL } from "@/site";

function FooterExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} className="hover:text-foreground inline-flex items-center gap-1">
      {children}
      <ArrowUpRight className="size-3" aria-hidden="true" />
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="pixel-rule" aria-hidden="true" />
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="flex max-w-xs flex-col gap-3">
            <Link to="/" aria-label="cpm home" className="self-start">
              <BrandMark />
            </Link>
            <p className="text-muted-foreground text-sm">The package manager for ComputerCraft.</p>
            <p className="text-muted-foreground mt-auto pt-4 text-xs">© 2026 ChungIndustries</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:gap-20">
            <nav aria-label="Site pages">
              <h3 className="font-display mb-3 text-xs">Site</h3>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  <Link to="/packages" className="hover:text-foreground">
                    Packages
                  </Link>
                </li>
                <li>
                  <Link to="/" hash="get-started" className="hover:text-foreground">
                    Get started
                  </Link>
                </li>
                <li>
                  <Link to="/" hash="commands" className="hover:text-foreground">
                    Commands
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="External resources">
              <h3 className="font-display mb-3 text-xs">Resources</h3>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  <FooterExternalLink href="https://chungindustries.com">
                    ChungIndustries
                  </FooterExternalLink>
                </li>
                <li>
                  <FooterExternalLink href={DOCS_URL}>Registry API</FooterExternalLink>
                </li>
                <li>
                  <FooterExternalLink href={GITHUB_URL}>GitHub</FooterExternalLink>
                </li>
                <li>
                  <FooterExternalLink href="https://tweaked.cc">CC:Tweaked</FooterExternalLink>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
