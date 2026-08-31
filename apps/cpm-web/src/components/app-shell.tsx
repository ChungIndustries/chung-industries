import type { ReactNode } from "react";

import { SiteFooter } from "@/components/footer";
import { SiteHeader } from "@/components/header";

/** The chrome every page shares: sticky header, content, footer. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
