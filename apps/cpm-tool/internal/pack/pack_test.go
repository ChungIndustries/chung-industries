package pack

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/manifest"
	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/registry"
)

func fixture(t *testing.T) *manifest.Package {
	t.Helper()
	dir := t.TempDir()
	files := map[string]string{
		"cpm.json":                 `{ "name": "demo", "version": "1.0.0", "startup": "startup.lua", "root": "." }`,
		"startup.lua":              "print('boot')",
		"init.lua":                 "return require('demo.lib')",
		"lib/util.lua":             "return {}",
		"lib/a/deep/file.lua":      "",
		"node_modules/x/index.js":  "ignored",
		".git/HEAD":                "ignored",
		"dist/demo-0.9.0.tgz":      "ignored",
		"lib/node_modules/y/z.lua": "ignored",
	}
	for name, content := range files {
		path := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	pkg, err := manifest.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	return pkg
}

type entry struct {
	header *tar.Header
	data   []byte
}

func read(t *testing.T, data []byte) []entry {
	t.Helper()
	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	tr := tar.NewReader(gz)
	var entries []entry
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(tr)
		if err != nil {
			t.Fatal(err)
		}
		entries = append(entries, entry{h, body})
	}
	return entries
}

func TestPackLayout(t *testing.T) {
	pkg := fixture(t)
	result, err := Pack(pkg)
	if err != nil {
		t.Fatal(err)
	}

	want := []string{"cpm.json", "init.lua", "lib/a/deep/file.lua", "lib/util.lua", "startup.lua"}
	if !reflect.DeepEqual(result.Files, want) {
		t.Fatalf("files = %v, want %v", result.Files, want)
	}

	entries := read(t, result.Data)
	var names []string
	for _, e := range entries {
		names = append(names, e.header.Name)
		if e.header.Typeflag != tar.TypeReg {
			t.Errorf("%s: typeflag %v, want regular file", e.header.Name, e.header.Typeflag)
		}
		if e.header.Mode != 0o644 {
			t.Errorf("%s: mode %o, want 644", e.header.Name, e.header.Mode)
		}
		if !e.header.ModTime.Equal(time.Unix(0, 0)) {
			t.Errorf("%s: mtime %v, want the epoch", e.header.Name, e.header.ModTime)
		}
		if e.header.Uid != 0 || e.header.Gid != 0 || e.header.Uname != "" || e.header.Gname != "" {
			t.Errorf("%s: owner fields leaked: %+v", e.header.Name, e.header)
		}
		if strings.HasPrefix(e.header.Name, "./") || strings.Contains(e.header.Name, "\\") {
			t.Errorf("%s: archive paths must be bare forward-slash paths", e.header.Name)
		}
	}
	if !reflect.DeepEqual(names, want) {
		t.Fatalf("archive entries = %v, want %v", names, want)
	}

	// The committed cpm.json is replaced by the resolved manifest, verbatim JSON
	// of the registry's metadata type.
	var got registry.PackageVersionMetadata
	if err := json.Unmarshal(entries[0].data, &got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, pkg.Metadata) {
		t.Fatalf("manifest in tarball = %+v, want %+v", got, pkg.Metadata)
	}
	if strings.Contains(string(entries[0].data), `"root"`) {
		t.Fatal("the tooling-only root field must not reach the registry manifest")
	}
}

func TestPackIsReproducible(t *testing.T) {
	pkg := fixture(t)
	first, err := Pack(pkg)
	if err != nil {
		t.Fatal(err)
	}
	// Touch a file's mtime so only content, not timestamps, can affect the bytes.
	future := time.Now().Add(48 * time.Hour)
	if err := os.Chtimes(filepath.Join(pkg.Root, "init.lua"), future, future); err != nil {
		t.Fatal(err)
	}
	second, err := Pack(pkg)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(first.Data, second.Data) {
		t.Fatal("packing the same files twice produced different bytes")
	}
}

func TestFileName(t *testing.T) {
	if got := FileName(registry.PackageVersionMetadata{Name: "cli", Version: "0.0.3"}); got != "cli-0.0.3.tgz" {
		t.Fatalf("FileName = %q", got)
	}
}
