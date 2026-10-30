package manifest

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// write creates files under dir from slash-separated relative paths.
func write(t *testing.T, dir string, files map[string]string) {
	t.Helper()
	for name, content := range files {
		path := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func expectError(t *testing.T, err error, want string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected an error containing %q, got nil", want)
	}
	if !strings.Contains(err.Error(), want) {
		t.Fatalf("expected an error containing %q, got %q", want, err)
	}
}

func TestLoadStandaloneManifest(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, map[string]string{
		"cpm.json": `{
  "name": "greet",
  "version": "1.2.3",
  "description": "Greeting utilities",
  "author": "someone",
  "startup": "startup.lua",
  "dependencies": { "cli": "^0.0.3" }
}`,
		"startup.lua": "print('hi')",
	})

	pkg, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if pkg.Root != pkg.Dir {
		t.Fatalf("root defaults to the package dir, got %q vs %q", pkg.Root, pkg.Dir)
	}
	m := pkg.Metadata
	if m.Name != "greet" || m.Version != "1.2.3" {
		t.Fatalf("name/version = %q/%q", m.Name, m.Version)
	}
	if *m.Description != "Greeting utilities" || *m.Author != "someone" || *m.Startup != "startup.lua" {
		t.Fatalf("optional fields not carried: %+v", m)
	}
	if (*m.Dependencies)["cli"] != "^0.0.3" {
		t.Fatalf("dependencies = %v", *m.Dependencies)
	}
}

func TestLoadOmitsAbsentOptionalFields(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, map[string]string{"cpm.json": `{ "name": "bare", "version": "0.1.0" }`})
	pkg, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	m := pkg.Metadata
	if m.Description != nil || m.Author != nil || m.Startup != nil || m.Dependencies != nil {
		t.Fatalf("expected nil optional fields, got %+v", m)
	}
}

func TestLoadFillsFromPackageJSON(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, map[string]string{
		"cpm.json":     `{ "name": "cli", "root": "src" }`,
		"package.json": `{ "name": "cli", "version": "0.0.3", "description": "A CLI library", "author": { "name": "chungindustries" } }`,
		"src/init.lua": "return {}",
	})

	pkg, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	m := pkg.Metadata
	if m.Version != "0.0.3" || *m.Description != "A CLI library" || *m.Author != "chungindustries" {
		t.Fatalf("package.json fallbacks not applied: %+v", m)
	}
	if pkg.Root != filepath.Join(dir, "src") {
		t.Fatalf("root = %q", pkg.Root)
	}
}

func TestLoadPrefersCpmJSONOverPackageJSON(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, map[string]string{
		"cpm.json":     `{ "name": "x", "version": "2.0.0", "author": "explicit" }`,
		"package.json": `{ "version": "1.0.0", "author": "fallback" }`,
	})
	pkg, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if pkg.Metadata.Version != "2.0.0" || *pkg.Metadata.Author != "explicit" {
		t.Fatalf("cpm.json should win: %+v", pkg.Metadata)
	}
}

func TestLoadErrors(t *testing.T) {
	cases := []struct {
		name  string
		files map[string]string
		want  string
	}{
		{"missing manifest", map[string]string{}, "no cpm.json"},
		{"missing name", map[string]string{"cpm.json": `{ "version": "1.0.0" }`}, `"name" is required`},
		{"dotted name", map[string]string{"cpm.json": `{ "name": "a.b", "version": "1.0.0" }`}, "letters, digits, hyphens, and underscores"},
		{"missing version", map[string]string{"cpm.json": `{ "name": "a" }`}, `"version" is required`},
		{"bad version", map[string]string{"cpm.json": `{ "name": "a", "version": "1.0" }`}, "not a semantic version"},
		{"unknown field", map[string]string{"cpm.json": `{ "name": "a", "version": "1.0.0", "dependecies": {} }`}, "dependecies"},
		{"missing startup", map[string]string{"cpm.json": `{ "name": "a", "version": "1.0.0", "startup": "boot.lua" }`}, "startup file"},
		{"missing root", map[string]string{"cpm.json": `{ "name": "a", "version": "1.0.0", "root": "src" }`}, "not a directory"},
		{"bad dependency name", map[string]string{"cpm.json": `{ "name": "a", "version": "1.0.0", "dependencies": { "b.c": "^1.0.0" } }`}, "dependency name"},
		{"bad range", map[string]string{"cpm.json": `{ "name": "a", "version": "1.0.0", "dependencies": { "b": "latest-ish?" } }`}, "not a semantic version range"},
		{"workspace range outside a workspace", map[string]string{"cpm.json": `{ "name": "a", "version": "1.0.0", "dependencies": { "b": "workspace:^" } }`}, "pnpm-workspace.yaml"},
		{"unsupported workspace range", map[string]string{"cpm.json": `{ "name": "a", "version": "1.0.0", "dependencies": { "b": "workspace:1.0.0" } }`}, "unsupported range"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			write(t, dir, tc.files)
			_, err := Load(dir)
			expectError(t, err, tc.want)
		})
	}
}

// workspace lays out a pnpm workspace with a `cli` package the others can
// depend on, returning the root.
func workspace(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	write(t, root, map[string]string{
		"pnpm-workspace.yaml":              "packages:\n  - apps/*\n  - packages/cc/*\n",
		"packages/cc/cli/cpm.json":         `{ "name": "cli", "root": "src" }`,
		"packages/cc/cli/package.json":     `{ "name": "cli", "version": "0.0.3" }`,
		"packages/cc/cli/src/init.lua":     "return {}",
		"node_modules/cli/cpm.json":        `{ "name": "cli", "version": "9.9.9" }`,
		"apps/cpm-cli/package.json":        `{ "name": "cpm-cli", "version": "0.0.4", "description": "The client." }`,
		"apps/cpm-cli/src/startup.lua":     "",
		"apps/cpm-cli/src/bin/cpm.lua":     "",
		"apps/cpm-cli/dist/stale/cpm.json": `{ "name": "cli", "version": "0.0.1" }`,
	})
	return root
}

func TestWorkspaceRanges(t *testing.T) {
	cases := map[string]string{"workspace:^": "^0.0.3", "workspace:~": "~0.0.3", "workspace:*": "0.0.3"}
	for spec, want := range cases {
		t.Run(spec, func(t *testing.T) {
			root := workspace(t)
			dir := filepath.Join(root, "apps", "cpm-cli")
			write(t, dir, map[string]string{
				"cpm.json": `{ "name": "cpm", "root": "src", "startup": "startup.lua", "dependencies": { "cli": "` + spec + `" } }`,
			})
			pkg, err := Load(dir)
			if err != nil {
				t.Fatal(err)
			}
			if got := (*pkg.Metadata.Dependencies)["cli"]; got != want {
				t.Fatalf("cli range = %q, want %q", got, want)
			}
			if pkg.Metadata.Version != "0.0.4" || *pkg.Metadata.Description != "The client." {
				t.Fatalf("package.json fallbacks missing: %+v", pkg.Metadata)
			}
		})
	}
}

func TestWorkspaceRangeUnknownPackage(t *testing.T) {
	root := workspace(t)
	dir := filepath.Join(root, "apps", "cpm-cli")
	write(t, dir, map[string]string{
		"cpm.json": `{ "name": "cpm", "root": "src", "dependencies": { "nope": "workspace:^" } }`,
	})
	_, err := Load(dir)
	expectError(t, err, `no package named "nope"`)
}

func TestWorkspaceRangeAmbiguousPackage(t *testing.T) {
	root := workspace(t)
	write(t, root, map[string]string{"packages/cc/cli2/cpm.json": `{ "name": "cli", "version": "1.0.0" }`})
	dir := filepath.Join(root, "apps", "cpm-cli")
	write(t, dir, map[string]string{
		"cpm.json": `{ "name": "cpm", "root": "src", "dependencies": { "cli": "workspace:^" } }`,
	})
	_, err := Load(dir)
	expectError(t, err, "more than one workspace package")
}
