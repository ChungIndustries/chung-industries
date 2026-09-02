// Package cpmtool is the module root; it exposes the tool's version.
package cpmtool

import (
	_ "embed"
	"encoding/json"
)

// package.json is the nx project manifest and the version's single source of
// truth (nx release bumps it). Embedding it means `go run` and a built binary
// report the same version with no build-time flag plumbing.
//
//go:embed package.json
var packageJSON []byte

// Version returns the tool's version from package.json.
func Version() string {
	var manifest struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(packageJSON, &manifest); err != nil || manifest.Version == "" {
		return "unknown"
	}
	return manifest.Version
}
