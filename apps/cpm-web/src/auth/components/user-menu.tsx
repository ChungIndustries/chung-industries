import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { LogIn, LogOut, User } from "lucide-react";

import { useSignOut } from "@/auth/hooks";
import { sessionQueryOptions } from "@/auth/queries";

/**
 * The header's account slot: a sign-in link when anonymous, the user's avatar
 * with an account menu when signed in. The session is ensured by the root
 * route, so this renders correctly on the server too.
 */
export function UserMenu() {
  const { data: session } = useQuery(sessionQueryOptions);
  const signOut = useSignOut();

  if (!session) {
    return (
      <Link
        to="/signin"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
        activeProps={{ className: "text-foreground" }}
      >
        <LogIn className="size-4" aria-hidden="true" />
        Sign in
      </Link>
    );
  }

  const { user } = session;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarImage src={user.image ?? undefined} alt="" />
            <AvatarFallback>{user.name.slice(0, 1).toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>
          <span className="block truncate">{user.name}</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <User aria-hidden="true" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut.mutate()}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
