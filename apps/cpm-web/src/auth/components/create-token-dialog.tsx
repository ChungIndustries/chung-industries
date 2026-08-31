import { useForm } from "@tanstack/react-form";
import { useCopyToClipboard } from "@workspace/hooks/use-copy-to-clipboard";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";
import { Check, Copy, Plus } from "lucide-react";
import { useState } from "react";

import { useCreateToken } from "@/auth/hooks";
import { TOKEN_EXPIRY_DAYS, createTokenSchema } from "@/auth/schemas";

function expiryLabel(days: (typeof TOKEN_EXPIRY_DAYS)[number]): string {
  return days === 365 ? "1 year" : `${days} days`;
}

/**
 * Mints a publish token. Two-phase dialog: the form first, then a one-time
 * reveal of the raw token, which the registry stores only as a hash and never
 * shows again.
 */
export function CreateTokenDialog() {
  const [open, setOpen] = useState(false);
  const createToken = useCreateToken();

  const form = useForm({
    defaultValues: {
      name: "",
      expiresInDays: 90 as (typeof TOKEN_EXPIRY_DAYS)[number],
    },
    validators: {
      onSubmit: createTokenSchema,
    },
    onSubmit: async ({ value }) => {
      await createToken.mutateAsync(value);
    },
  });

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset();
      createToken.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden="true" />
          New token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {createToken.data ? (
          <TokenReveal token={createToken.data.key} onDone={() => onOpenChange(false)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New publish token</DialogTitle>
              <DialogDescription>
                Mint one token per machine that publishes, named after the machine, so revoking one
                never breaks another.
              </DialogDescription>
            </DialogHeader>
            <form
              id="create-token"
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
              className="flex flex-col gap-4"
            >
              <form.Field name="name">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                      <Input
                        id={field.name}
                        placeholder="e.g. laptop, release-ci"
                        autoComplete="off"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field name="expiresInDays">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Expires after</FieldLabel>
                    <Select
                      value={String(field.state.value)}
                      onValueChange={(value) =>
                        field.handleChange(Number(value) as (typeof TOKEN_EXPIRY_DAYS)[number])
                      }
                    >
                      <SelectTrigger id={field.name} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TOKEN_EXPIRY_DAYS.map((days) => (
                          <SelectItem key={days} value={String(days)}>
                            {expiryLabel(days)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
              {createToken.error && (
                <p className="text-destructive text-sm">{createToken.error.message}</p>
              )}
            </form>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="create-token" disabled={createToken.isPending}>
                {createToken.isPending && <Spinner />}
                Create token
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TokenReveal({ token, onDone }: { token: string; onDone: () => void }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <>
      <DialogHeader>
        <DialogTitle>Copy your token now</DialogTitle>
        <DialogDescription>
          This is the only time it is shown; the registry keeps just a hash. Treat it like a
          password.
        </DialogDescription>
      </DialogHeader>
      <div className="border-border bg-muted/40 flex items-center gap-2 rounded-md border p-3">
        <code className="min-w-0 flex-1 font-mono text-sm break-all select-all">{token}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Copy token"
          onClick={() => void copy(token)}
        >
          {copied ? (
            <Check className="text-screen-green" aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Use it as <code>Authorization: Bearer &lt;token&gt;</code> when publishing, or store it in
        your CI secrets.
      </p>
      <DialogFooter>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
