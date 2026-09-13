// Package pack builds the publish artifact: a gzipped tar of the package files
// with the resolved cpm.json at its root, reproducible byte for byte across
// builds of the same files.
package pack

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/manifest"
	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/registry"
)

// Directories never packed, at any depth: VCS state, Node dependencies, and
// the build output the tarball itself lands in.
var skipDirs = map[string]bool{".git": true, "node_modules": true, "dist": true}

// Result is a built tarball.
type Result struct {
	Data []byte
	// Files are the archive paths, cpm.json first, then sorted.
	Files []string
}

// FileName is the tarball's conventional name: <name>-<version>.tgz.
func FileName(m registry.PackageVersionMetadata) string {
	return fmt.Sprintf("%s-%s.tgz", m.Name, m.Version)
}

// Pack archives the package's root directory. Entries are regular files only,
// sorted by path with forward slashes and no leading "./" (so `init.lua` is at
// the archive root, as the registry requires), with a fixed zero mtime,
// owner, and mode so the same files always produce the same bytes. A cpm.json
// in the root is replaced by the resolved manifest.
func Pack(pkg *manifest.Package) (*Result, error) {
	paths, err := collect(pkg.Root)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	manifestJSON, err := json.MarshalIndent(pkg.Metadata, "", "  ")
	if err != nil {
		return nil, err
	}
	manifestJSON = append(manifestJSON, '\n')
	if err := writeEntry(tw, manifest.FileName, manifestJSON); err != nil {
		return nil, err
	}
	files := []string{manifest.FileName}
	for _, p := range paths {
		data, err := os.ReadFile(filepath.Join(pkg.Root, filepath.FromSlash(p)))
		if err != nil {
			return nil, err
		}
		if err := writeEntry(tw, p, data); err != nil {
			return nil, err
		}
		files = append(files, p)
	}

	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return &Result{Data: buf.Bytes(), Files: files}, nil
}

// collect lists the package files as sorted slash paths relative to root.
func collect(root string) ([]string, error) {
	var paths []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if d.IsDir() {
			if path != root && skipDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		slash := filepath.ToSlash(relPath)
		if slash == manifest.FileName {
			return nil
		}
		if !d.Type().IsRegular() {
			return fmt.Errorf("%s is not a regular file; packages can only contain plain files", slash)
		}
		paths = append(paths, slash)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(paths)
	return paths, nil
}

func writeEntry(tw *tar.Writer, name string, data []byte) error {
	header := &tar.Header{
		Typeflag: tar.TypeReg,
		Name:     name,
		Mode:     0o644,
		Size:     int64(len(data)),
		ModTime:  time.Unix(0, 0),
	}
	if err := tw.WriteHeader(header); err != nil {
		return err
	}
	_, err := tw.Write(data)
	return err
}
