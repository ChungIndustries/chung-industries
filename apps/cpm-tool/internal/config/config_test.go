package config

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestPathHonoursOverride(t *testing.T) {
	t.Setenv(EnvPath, "/tmp/elsewhere/config.json")
	got, err := Path()
	if err != nil {
		t.Fatal(err)
	}
	if got != "/tmp/elsewhere/config.json" {
		t.Fatalf("Path() = %q", got)
	}
}

func TestPathDefaultsUnderUserConfigDir(t *testing.T) {
	t.Setenv(EnvPath, "")
	got, err := Path()
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(got) != "config.json" || filepath.Base(filepath.Dir(got)) != "cpm" {
		t.Fatalf("Path() = %q, want .../cpm/config.json", got)
	}
}

func TestLoadMissingFileIsEmpty(t *testing.T) {
	f, err := Load(filepath.Join(t.TempDir(), "missing.json"))
	if err != nil {
		t.Fatal(err)
	}
	if len(f.Registries) != 0 {
		t.Fatalf("expected no registries, got %v", f.Registries)
	}
}

func TestLoadRejectsBrokenJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil || !strings.Contains(err.Error(), "not valid config JSON") {
		t.Fatalf("expected a JSON error, got %v", err)
	}
}

func TestSaveAndLoadRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "cpm", "config.json")
	f := &File{Registries: map[string]Registry{}}
	f.SetToken("https://registry.example/", "cpm_abc")
	if err := f.Save(path); err != nil {
		t.Fatal(err)
	}

	loaded, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	// Trailing slashes never matter: the key is normalized on write and read.
	if got := loaded.Token("https://registry.example"); got != "cpm_abc" {
		t.Fatalf("Token() = %q", got)
	}
	if got := loaded.Token("https://registry.example///"); got != "cpm_abc" {
		t.Fatalf("Token() with slashes = %q", got)
	}
	if got := loaded.Token("https://other.example"); got != "" {
		t.Fatalf("Token() for unknown registry = %q", got)
	}

	if runtime.GOOS != "windows" {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if perm := info.Mode().Perm(); perm != 0o600 {
			t.Fatalf("config file mode = %o, want 600", perm)
		}
	}
}

func TestDeleteToken(t *testing.T) {
	f := &File{Registries: map[string]Registry{}}
	f.SetToken("https://registry.example", "cpm_abc")
	if !f.DeleteToken("https://registry.example/") {
		t.Fatal("expected DeleteToken to report a removed entry")
	}
	if f.DeleteToken("https://registry.example") {
		t.Fatal("expected a second DeleteToken to report nothing to remove")
	}
}
