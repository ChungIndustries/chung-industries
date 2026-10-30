// Package cli defines the cpm command tree.
package cli

import (
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/spf13/cobra"

	cpmtool "github.com/ChungIndustries/chung-industries/apps/cpm-tool"
	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/config"
	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/registry"
)

const (
	envRegistry = "CPM_REGISTRY_URL"
	envToken    = "CPM_REGISTRY_TOKEN"
	// Where tokens for the official registry are created.
	defaultAccountURL = "https://cpm.chungindustries.com/account"
)

// options carries the flags shared across commands.
type options struct {
	registry string
}

// NewRootCmd builds the command tree. Commands write to the command's own
// output streams so tests can capture them.
func NewRootCmd() *cobra.Command {
	opts := &options{}
	root := &cobra.Command{
		Use:   "cpm",
		Short: "Publish packages to the cpm registry",
		Long: `cpm packs and publishes packages to the cpm registry from a real computer.

A package is a directory with a cpm.json describing it. Run the commands in
that directory, or point them at it with --dir.`,
		Version:       cpmtool.Version(),
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.PersistentFlags().StringVar(&opts.registry, "registry", "",
		fmt.Sprintf("registry URL (default $%s, then %s)", envRegistry, registry.DefaultURL))
	root.AddCommand(
		newLoginCmd(opts),
		newLogoutCmd(opts),
		newWhoamiCmd(opts),
		newPackCmd(opts),
		newPublishCmd(opts),
	)
	return root
}

// Execute runs the tool and returns the process exit code.
func Execute() int {
	if err := NewRootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "cpm:", err)
		return 1
	}
	return 0
}

// registryURL is the target registry: flag, then environment, then the default.
func (o *options) registryURL() string {
	if o.registry != "" {
		return registry.NormalizeURL(o.registry)
	}
	if fromEnv := os.Getenv(envRegistry); fromEnv != "" {
		return registry.NormalizeURL(fromEnv)
	}
	return registry.DefaultURL
}

// credential is a token together with where it came from, for messages.
type credential struct {
	token  string
	source string
}

// resolveToken finds the token to use: the --token flag, then
// CPM_REGISTRY_TOKEN, then the config file's entry for the registry.
func (o *options) resolveToken(flag string) (credential, error) {
	if flag != "" {
		return credential{token: flag, source: "--token"}, nil
	}
	if fromEnv := os.Getenv(envToken); fromEnv != "" {
		return credential{token: fromEnv, source: envToken}, nil
	}
	path, err := config.Path()
	if err != nil {
		return credential{}, err
	}
	cfg, err := config.Load(path)
	if err != nil {
		return credential{}, err
	}
	if token := cfg.Token(o.registryURL()); token != "" {
		return credential{token: token, source: "config file"}, nil
	}
	return credential{}, fmt.Errorf("not logged in to %s; run `cpm login`, or set %s", o.registryURL(), envToken)
}

func (o *options) client(token string) *registry.Client {
	return registry.NewClient(o.registryURL(), token, "cpm/"+cpmtool.Version())
}

// describeAuthError turns a rejected credential into advice.
func describeAuthError(err error, registryURL string) error {
	if registry.IsStatus(err, 401) {
		return fmt.Errorf("%s rejected the token: %w", registryURL, err)
	}
	return err
}

func hasScope(actor *registry.Actor, scope registry.ActorScopes) bool {
	for _, s := range actor.Scopes {
		if s == scope {
			return true
		}
	}
	return false
}

func scopeList(actor *registry.Actor) string {
	if len(actor.Scopes) == 0 {
		return "none"
	}
	out := ""
	for i, s := range actor.Scopes {
		if i > 0 {
			out += ", "
		}
		out += string(s)
	}
	return out
}

// humanBytes renders a size for status lines.
func humanBytes(n int) string {
	switch {
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MiB", float64(n)/(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.1f KiB", float64(n)/(1<<10))
	default:
		return fmt.Sprintf("%d bytes", n)
	}
}

// errNoToken is returned by login when nothing was pasted.
var errNoToken = errors.New("no token given")

// warn writes a note to the command's error stream.
func warn(w io.Writer, format string, args ...any) {
	fmt.Fprintf(w, "Note: "+format+"\n", args...)
}
