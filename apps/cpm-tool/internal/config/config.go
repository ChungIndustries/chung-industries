// Package config is the per-user config file: the registries the user has
// logged in to and the publish token saved for each.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/registry"
)

// EnvPath overrides the config file location when set.
const EnvPath = "CPM_CONFIG"

// File is the on-disk shape. Tokens are keyed by registry URL so a local
// registry and the official one can both be logged in at once.
type File struct {
	Registries map[string]Registry `json:"registries"`
}

// Registry is what the user saved for one registry.
type Registry struct {
	Token string `json:"token"`
}

// Path returns the config file location: $CPM_CONFIG when set, otherwise
// cpm/config.json under the OS user config directory (~/.config on Linux,
// ~/Library/Application Support on macOS, %AppData% on Windows).
func Path() (string, error) {
	if override := os.Getenv(EnvPath); override != "" {
		return override, nil
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("locating the user config directory: %w", err)
	}
	return filepath.Join(base, "cpm", "config.json"), nil
}

// Load reads the config file at path. A missing file is an empty config, not
// an error.
func Load(path string) (*File, error) {
	f := &File{Registries: map[string]Registry{}}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return f, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", path, err)
	}
	if err := json.Unmarshal(raw, f); err != nil {
		return nil, fmt.Errorf("%s is not valid config JSON: %w", path, err)
	}
	if f.Registries == nil {
		f.Registries = map[string]Registry{}
	}
	return f, nil
}

// Save writes the config file, readable by the owner only since it holds
// tokens.
func (f *File) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("creating %s: %w", filepath.Dir(path), err)
	}
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o600); err != nil {
		return fmt.Errorf("writing %s: %w", path, err)
	}
	return nil
}

// Token returns the saved token for a registry, or "" when not logged in.
func (f *File) Token(registryURL string) string {
	return f.Registries[registry.NormalizeURL(registryURL)].Token
}

// SetToken saves the token for a registry.
func (f *File) SetToken(registryURL, token string) {
	f.Registries[registry.NormalizeURL(registryURL)] = Registry{Token: token}
}

// DeleteToken forgets a registry's token, reporting whether there was one.
func (f *File) DeleteToken(registryURL string) bool {
	key := registry.NormalizeURL(registryURL)
	_, ok := f.Registries[key]
	delete(f.Registries, key)
	return ok
}
