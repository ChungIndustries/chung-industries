package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/manifest"
	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/pack"
	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/registry"
)

func newPackCmd(opts *options) *cobra.Command {
	var dir string
	cmd := &cobra.Command{
		Use:   "pack",
		Short: "Build the package tarball into dist/",
		Long: `Builds dist/<name>-<version>.tgz from the package's cpm.json: its root
directory's files plus the resolved manifest at the archive root. The same
files always produce the same bytes.`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			pkg, err := manifest.Load(dir)
			if err != nil {
				return err
			}
			result, err := pack.Pack(pkg)
			if err != nil {
				return err
			}
			outDir := filepath.Join(pkg.Dir, "dist")
			if err := os.MkdirAll(outDir, 0o755); err != nil {
				return err
			}
			outPath := filepath.Join(outDir, pack.FileName(pkg.Metadata))
			if err := os.WriteFile(outPath, result.Data, 0o644); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "Packed %s (%d files, %s)\n",
				displayPath(outPath), len(result.Files), humanBytes(len(result.Data)))
			return nil
		},
	}
	cmd.Flags().StringVar(&dir, "dir", ".", "the package directory (holds cpm.json)")
	return cmd
}

func newPublishCmd(opts *options) *cobra.Command {
	var dir, token string
	cmd := &cobra.Command{
		Use:   "publish",
		Short: "Pack the package and upload it to the registry",
		Long: `Packs the package (as pack does, without writing dist/) and uploads it.

Needs a publish token: --token, CPM_REGISTRY_TOKEN, or a saved login. Published
versions are immutable, so a version the registry already has is reported and
treated as success, which keeps release re-runs idempotent.`,
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			registryURL := opts.registryURL()
			// Resolve the credential before packing so a missing login fails fast.
			cred, err := opts.resolveToken(token)
			if err != nil {
				return err
			}
			pkg, err := manifest.Load(dir)
			if err != nil {
				return err
			}
			result, err := pack.Pack(pkg)
			if err != nil {
				return err
			}

			id := pkg.Metadata.Name + "@" + pkg.Metadata.Version
			_, err = opts.client(cred.token).Publish(cmd.Context(), pack.FileName(pkg.Metadata), result.Data)
			if registry.IsStatus(err, 409) {
				fmt.Fprintf(cmd.OutOrStdout(), "%s is already published to %s; nothing to do.\n", id, registryURL)
				return nil
			}
			if err != nil {
				return fmt.Errorf("publishing %s to %s failed: %w", id, registryURL, describeAuthError(err, registryURL))
			}
			fmt.Fprintf(cmd.OutOrStdout(), "Published %s to %s (%d files, %s).\n",
				id, registryURL, len(result.Files), humanBytes(len(result.Data)))
			return nil
		},
	}
	cmd.Flags().StringVar(&dir, "dir", ".", "the package directory (holds cpm.json)")
	cmd.Flags().StringVar(&token, "token", "", fmt.Sprintf("the publish token (default $%s, then the saved login)", envToken))
	return cmd
}

// displayPath shows a path relative to the working directory when it is
// inside it.
func displayPath(path string) string {
	wd, err := os.Getwd()
	if err != nil {
		return path
	}
	if r, err := filepath.Rel(wd, path); err == nil && !filepath.IsAbs(r) && r != ".." && !hasParentPrefix(r) {
		return filepath.ToSlash(r)
	}
	return path
}

func hasParentPrefix(rel string) bool {
	return len(rel) >= 3 && rel[:3] == ".."+string(filepath.Separator)
}
