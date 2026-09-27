package main

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// The formatting check lives in the test suite so `nx test cpm-tool` covers
// it on every platform without a separate formatter install: gofmt ships with
// the Go toolchain the tests already run under.
func TestSourceIsGofmtClean(t *testing.T) {
	goroot, err := exec.Command("go", "env", "GOROOT").Output()
	if err != nil {
		t.Fatalf("go env GOROOT: %v", err)
	}
	gofmt := filepath.Join(strings.TrimSpace(string(goroot)), "bin", "gofmt")
	out, err := exec.Command(gofmt, "-l", filepath.Join("..", "..")).CombinedOutput()
	if err != nil {
		t.Fatalf("gofmt failed: %v\n%s", err, out)
	}
	if unformatted := strings.TrimSpace(string(out)); unformatted != "" {
		t.Fatalf("files need gofmt:\n%s", unformatted)
	}
}
