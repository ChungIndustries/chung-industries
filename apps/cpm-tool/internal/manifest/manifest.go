// Package manifest loads a package's committed cpm.json and resolves it into
// the manifest the registry reads from the tarball root.
//
// cpm.json is the registry manifest (name, version, description, author,
// startup, dependencies) plus one tooling field, `root`: the directory whose
// contents are the package files (default: the directory holding cpm.json).
//
// Two conveniences bridge it to a Node workspace, so a version bumped by
// `nx release` stays the single source of truth:
//   - version, description, and author may be omitted from cpm.json when a
//     package.json beside it supplies them.
//   - a dependency range of `workspace:^`, `workspace:~`, or `workspace:*` is
//     resolved, pnpm-style, against the version of the workspace package with
//     that name (found by its own cpm.json under the nearest pnpm-workspace.yaml).
package manifest

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/Masterminds/semver/v3"

	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/registry"
)

// FileName is the manifest's file name, in the package directory and at the
// tarball root.
const FileName = "cpm.json"

// workspaceMarker names a pnpm workspace root, the search scope for
// `workspace:` dependency ranges.
const workspaceMarker = "pnpm-workspace.yaml"

// Mirrors the registry's package name rule (dots are reserved).
var namePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// Package is a loaded, resolved package ready to pack.
type Package struct {
	// Dir holds cpm.json.
	Dir string
	// Root is the directory whose contents are the package files.
	Root string
	// Metadata is the resolved manifest written to the tarball root.
	Metadata registry.PackageVersionMetadata
}

// file is the committed cpm.json shape.
type file struct {
	Name         string            `json:"name"`
	Version      string            `json:"version"`
	Description  string            `json:"description"`
	Author       string            `json:"author"`
	Startup      string            `json:"startup"`
	Dependencies map[string]string `json:"dependencies"`
	Root         string            `json:"root"`
}

// packageJSON is the subset of a sibling package.json that can fill in for
// omitted cpm.json fields.
type packageJSON struct {
	Version     string          `json:"version"`
	Description string          `json:"description"`
	Author      json.RawMessage `json:"author"`
}

// Load reads and resolves the package in dir.
func Load(dir string) (*Package, error) {
	dir, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	m, err := read(dir)
	if err != nil {
		return nil, err
	}

	if !namePattern.MatchString(m.Name) {
		if m.Name == "" {
			return nil, fmt.Errorf("%s: \"name\" is required", rel(dir, FileName))
		}
		return nil, fmt.Errorf("%s: name %q may only contain letters, digits, hyphens, and underscores", rel(dir, FileName), m.Name)
	}
	if m.Version == "" {
		return nil, fmt.Errorf("%s: \"version\" is required (or put it in a package.json beside it)", rel(dir, FileName))
	}
	if _, err := semver.StrictNewVersion(m.Version); err != nil {
		return nil, fmt.Errorf("%s: version %q is not a semantic version", rel(dir, FileName), m.Version)
	}
	if len(m.Description) > 1024 {
		return nil, fmt.Errorf("%s: description is longer than 1024 characters", rel(dir, FileName))
	}

	root := dir
	if m.Root != "" {
		root = filepath.Join(dir, filepath.FromSlash(m.Root))
	}
	if info, err := os.Stat(root); err != nil || !info.IsDir() {
		return nil, fmt.Errorf("%s: root %q is not a directory", rel(dir, FileName), m.Root)
	}
	if m.Startup != "" {
		startup := filepath.Join(root, filepath.FromSlash(m.Startup))
		if info, err := os.Stat(startup); err != nil || info.IsDir() {
			return nil, fmt.Errorf("%s: startup file %q does not exist in the package root", rel(dir, FileName), m.Startup)
		}
	}

	deps, err := resolveDependencies(dir, m.Dependencies)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", rel(dir, FileName), err)
	}

	metadata := registry.PackageVersionMetadata{Name: m.Name, Version: m.Version}
	if m.Description != "" {
		metadata.Description = &m.Description
	}
	if m.Author != "" {
		metadata.Author = &m.Author
	}
	if m.Startup != "" {
		metadata.Startup = &m.Startup
	}
	if len(deps) > 0 {
		metadata.Dependencies = &deps
	}
	return &Package{Dir: dir, Root: root, Metadata: metadata}, nil
}

// read parses dir's cpm.json and fills omitted fields from a sibling
// package.json. Unknown fields are errors, matching the registry's strict
// manifest validation and catching typos before an upload.
func read(dir string) (*file, error) {
	path := filepath.Join(dir, FileName)
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("no %s in %s", FileName, dir)
	}
	if err != nil {
		return nil, err
	}
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.DisallowUnknownFields()
	var m file
	if err := dec.Decode(&m); err != nil {
		return nil, fmt.Errorf("%s: %w", rel(dir, FileName), err)
	}

	pkgRaw, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if errors.Is(err, os.ErrNotExist) {
		return &m, nil
	}
	if err != nil {
		return nil, err
	}
	var pkg packageJSON
	if err := json.Unmarshal(pkgRaw, &pkg); err != nil {
		return nil, fmt.Errorf("%s: %w", rel(dir, "package.json"), err)
	}
	if m.Version == "" {
		m.Version = pkg.Version
	}
	if m.Description == "" {
		m.Description = pkg.Description
	}
	if m.Author == "" {
		m.Author = authorName(pkg.Author)
	}
	return &m, nil
}

// authorName reads package.json's author, which is a string or an object
// with a name.
func authorName(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	var obj struct {
		Name string `json:"name"`
	}
	if json.Unmarshal(raw, &obj) == nil {
		return obj.Name
	}
	return ""
}

// resolveDependencies validates dependency names and ranges, resolving
// `workspace:` ranges against the workspace first.
func resolveDependencies(dir string, deps map[string]string) (map[string]string, error) {
	resolved := make(map[string]string, len(deps))
	names := make([]string, 0, len(deps))
	for name := range deps {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		spec := deps[name]
		if !namePattern.MatchString(name) {
			return nil, fmt.Errorf("dependency name %q may only contain letters, digits, hyphens, and underscores", name)
		}
		if strings.HasPrefix(spec, "workspace:") {
			var err error
			spec, err = resolveWorkspaceRange(dir, name, spec)
			if err != nil {
				return nil, err
			}
		}
		if _, err := semver.NewConstraint(spec); err != nil {
			return nil, fmt.Errorf("dependency %s: %q is not a semantic version range", name, spec)
		}
		resolved[name] = spec
	}
	return resolved, nil
}

// resolveWorkspaceRange turns `workspace:^` / `workspace:~` / `workspace:*`
// into a concrete range on the named workspace package's current version,
// the way pnpm rewrites them on publish.
func resolveWorkspaceRange(dir, name, spec string) (string, error) {
	op := strings.TrimPrefix(spec, "workspace:")
	switch op {
	case "^", "~", "*":
	default:
		return "", fmt.Errorf("dependency %s: unsupported range %q; use workspace:^, workspace:~, or workspace:*", name, spec)
	}
	wsRoot, err := findWorkspaceRoot(dir)
	if err != nil {
		return "", fmt.Errorf("dependency %s: %w", name, err)
	}
	version, err := findWorkspaceVersion(wsRoot, name)
	if err != nil {
		return "", fmt.Errorf("dependency %s: %w", name, err)
	}
	if op == "*" {
		return version, nil
	}
	return op + version, nil
}

// findWorkspaceRoot walks up from dir to the nearest pnpm workspace root.
func findWorkspaceRoot(dir string) (string, error) {
	for current := dir; ; {
		if _, err := os.Stat(filepath.Join(current, workspaceMarker)); err == nil {
			return current, nil
		}
		parent := filepath.Dir(current)
		if parent == current {
			return "", fmt.Errorf("workspace: ranges need a %s in a parent directory of the package, and none was found", workspaceMarker)
		}
		current = parent
	}
}

// findWorkspaceVersion finds the one package under root whose cpm.json names
// name, and returns its version.
func findWorkspaceVersion(root, name string) (string, error) {
	skip := map[string]bool{".git": true, "node_modules": true, "dist": true}
	var versions []string
	var dirs []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if path != root && skip[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if d.Name() != FileName {
			return nil
		}
		pkgDir := filepath.Dir(path)
		m, err := read(pkgDir)
		if err != nil {
			return err
		}
		if m.Name == name {
			versions = append(versions, m.Version)
			dirs = append(dirs, pkgDir)
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	switch len(versions) {
	case 0:
		return "", fmt.Errorf("no package named %q (by its %s) found under %s", name, FileName, root)
	case 1:
		if versions[0] == "" {
			return "", fmt.Errorf("workspace package %q at %s has no version", name, dirs[0])
		}
		return versions[0], nil
	default:
		return "", fmt.Errorf("package name %q is declared by more than one workspace package: %s", name, strings.Join(dirs, ", "))
	}
}

// rel renders a path inside dir for error messages.
func rel(dir, name string) string {
	return filepath.Join(filepath.Base(dir), name)
}
