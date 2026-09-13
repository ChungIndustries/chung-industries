package cli

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/config"
	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/registry"
)

func newLoginCmd(opts *options) *cobra.Command {
	var token string
	cmd := &cobra.Command{
		Use:   "login",
		Short: "Save a publish token for a registry",
		Long: `Saves a publish token for the registry so publish and whoami can use it.

Tokens are created on the registry's website. Paste one at the prompt, pipe it
on stdin, or pass --token. The token is verified with the registry before it
is saved to the config file (readable by you only).`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			registryURL := opts.registryURL()
			if token == "" {
				var err error
				token, err = promptToken(cmd, registryURL)
				if err != nil {
					return err
				}
			}
			token = strings.TrimSpace(token)
			if token == "" {
				return errNoToken
			}

			actor, err := opts.client(token).Me(cmd.Context())
			if err != nil {
				return describeAuthError(err, registryURL)
			}

			path, err := config.Path()
			if err != nil {
				return err
			}
			cfg, err := config.Load(path)
			if err != nil {
				return err
			}
			cfg.SetToken(registryURL, token)
			if err := cfg.Save(path); err != nil {
				return err
			}

			fmt.Fprintf(cmd.OutOrStdout(), "Logged in to %s as %s.\n", registryURL, actor.Name)
			if !hasScope(actor, registry.Publish) {
				warn(cmd.ErrOrStderr(), "this token cannot publish (scopes: %s).", scopeList(actor))
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&token, "token", "", "the publish token (prompted for when omitted)")
	return cmd
}

// promptToken reads a token from the terminal without echo, or the first line
// of a non-terminal stdin.
func promptToken(cmd *cobra.Command, registryURL string) (string, error) {
	in := cmd.InOrStdin()
	if f, ok := in.(*os.File); ok && term.IsTerminal(int(f.Fd())) {
		out := cmd.OutOrStdout()
		if registryURL == registry.DefaultURL {
			fmt.Fprintf(out, "Create a publish token at %s and paste it here.\n", defaultAccountURL)
		} else {
			fmt.Fprintf(out, "Create a publish token on the website for %s and paste it here.\n", registryURL)
		}
		fmt.Fprint(out, "Token: ")
		raw, err := term.ReadPassword(int(f.Fd()))
		fmt.Fprintln(out)
		if err != nil {
			return "", fmt.Errorf("reading the token: %w", err)
		}
		return string(raw), nil
	}
	line, err := bufio.NewReader(in).ReadString('\n')
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("reading the token from stdin: %w", err)
	}
	return line, nil
}

func newLogoutCmd(opts *options) *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Forget the saved token for a registry",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			registryURL := opts.registryURL()
			path, err := config.Path()
			if err != nil {
				return err
			}
			cfg, err := config.Load(path)
			if err != nil {
				return err
			}
			if !cfg.DeleteToken(registryURL) {
				fmt.Fprintf(cmd.OutOrStdout(), "Not logged in to %s; nothing to do.\n", registryURL)
				return nil
			}
			if err := cfg.Save(path); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "Logged out of %s.\n", registryURL)
			return nil
		},
	}
}

func newWhoamiCmd(opts *options) *cobra.Command {
	var token string
	cmd := &cobra.Command{
		Use:   "whoami",
		Short: "Show the account behind the current credential",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			registryURL := opts.registryURL()
			cred, err := opts.resolveToken(token)
			if err != nil {
				return err
			}
			actor, err := opts.client(cred.token).Me(cmd.Context())
			if err != nil {
				return describeAuthError(err, registryURL)
			}

			out := cmd.OutOrStdout()
			fmt.Fprintf(out, "%s (%s)\n", actor.Name, actor.UserId)
			fmt.Fprintf(out, "Registry: %s\n", registryURL)
			fmt.Fprintf(out, "Auth:     %s\n", describeAuth(actor, cred.source))
			fmt.Fprintf(out, "Scopes:   %s\n", scopeList(actor))
			return nil
		},
	}
	cmd.Flags().StringVar(&token, "token", "", fmt.Sprintf("the publish token (default $%s, then the saved login)", envToken))
	return cmd
}

// describeAuth renders how the actor authenticated, with the token's name and
// expiry when one was used.
func describeAuth(actor *registry.Actor, source string) string {
	if actor.Via != registry.Token {
		return "browser session"
	}
	name := "unnamed"
	expiry := "no expiry"
	if actor.Token != nil {
		if actor.Token.Name != nil && *actor.Token.Name != "" {
			name = *actor.Token.Name
		}
		if actor.Token.ExpiresAt != nil {
			expiry = "expires " + actor.Token.ExpiresAt.UTC().Format(time.DateOnly)
		}
	}
	return fmt.Sprintf("token %q, %s (from %s)", name, expiry, source)
}
