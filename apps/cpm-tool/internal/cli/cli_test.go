package cli

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/ChungIndustries/chung-industries/apps/cpm-tool/internal/config"
)

// fakeRegistry knows one token and remembers what was published, so a second
// publish of the same version conflicts like the real registry.
type fakeRegistry struct {
	*httptest.Server
	mu        sync.Mutex
	published map[string][]byte
}

func newFakeRegistry(t *testing.T) *fakeRegistry {
	t.Helper()
	f := &fakeRegistry{published: map[string][]byte{}}
	mux := http.NewServeMux()
	authorized := func(w http.ResponseWriter, r *http.Request) bool {
		if r.Header.Get("Authorization") == "Bearer cpm_good" {
			return true
		}
		w.WriteHeader(401)
		io.WriteString(w, `{"status":"fail","data":{"message":"Invalid or expired token"}}`)
		return false
	}
	mux.HandleFunc("GET /me", func(w http.ResponseWriter, r *http.Request) {
		if !authorized(w, r) {
			return
		}
		io.WriteString(w, `{"status":"success","data":{"userId":"u1","name":"Alice","via":"token","scopes":["publish"],"token":{"name":"laptop","expiresAt":"2026-12-01T00:00:00.000Z"}}}`)
	})
	mux.HandleFunc("POST /packages", func(w http.ResponseWriter, r *http.Request) {
		if !authorized(w, r) {
			return
		}
		file, header, err := r.FormFile("tarball")
		if err != nil {
			w.WriteHeader(400)
			io.WriteString(w, `{"status":"fail","data":{"message":"Tarball data is missing"}}`)
			return
		}
		defer file.Close()
		data, _ := io.ReadAll(file)
		f.mu.Lock()
		defer f.mu.Unlock()
		if _, exists := f.published[header.Filename]; exists {
			w.WriteHeader(409)
			io.WriteString(w, `{"status":"fail","data":{"message":"Version is already published and immutable"}}`)
			return
		}
		f.published[header.Filename] = data
		w.WriteHeader(201)
		io.WriteString(w, `{"status":"success","data":{"name":"demo","createdAt":"2026-01-01T00:00:00.000Z","dist-tags":{"latest":"1.0.0"},"versions":{}}}`)
	})
	f.Server = httptest.NewServer(mux)
	t.Cleanup(f.Close)
	return f
}

// run executes the tool with args, returning stdout, stderr, and the error.
func run(t *testing.T, stdin string, args ...string) (string, string, error) {
	t.Helper()
	var out, errOut bytes.Buffer
	root := NewRootCmd()
	root.SetOut(&out)
	root.SetErr(&errOut)
	root.SetIn(strings.NewReader(stdin))
	root.SetArgs(args)
	err := root.Execute()
	return out.String(), errOut.String(), err
}

// isolate points the config file at a temp location and clears the env vars
// the tool reads, so tests never touch the developer's real login.
func isolate(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.json")
	t.Setenv(config.EnvPath, path)
	t.Setenv(envToken, "")
	t.Setenv(envRegistry, "")
	return path
}

func packageDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	files := map[string]string{
		"cpm.json":        `{ "name": "demo", "version": "1.0.0", "root": "src", "startup": "startup.lua" }`,
		"src/startup.lua": "print('boot')",
		"src/init.lua":    "return {}",
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
	return dir
}

func TestLoginWithFlagSavesVerifiedToken(t *testing.T) {
	cfgPath := isolate(t)
	reg := newFakeRegistry(t)

	out, errOut, err := run(t, "", "login", "--registry", reg.URL, "--token", "cpm_good")
	if err != nil {
		t.Fatalf("login failed: %v (%s)", err, errOut)
	}
	if !strings.Contains(out, "Logged in to "+reg.URL+" as Alice.") {
		t.Fatalf("output = %q", out)
	}
	cfg, err := config.Load(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Token(reg.URL) != "cpm_good" {
		t.Fatalf("token not saved: %+v", cfg)
	}
}

func TestLoginReadsPipedToken(t *testing.T) {
	cfgPath := isolate(t)
	reg := newFakeRegistry(t)
	if _, _, err := run(t, "cpm_good\n", "login", "--registry", reg.URL); err != nil {
		t.Fatal(err)
	}
	cfg, _ := config.Load(cfgPath)
	if cfg.Token(reg.URL) != "cpm_good" {
		t.Fatal("piped token not saved")
	}
}

func TestLoginRejectsBadToken(t *testing.T) {
	cfgPath := isolate(t)
	reg := newFakeRegistry(t)
	_, _, err := run(t, "", "login", "--registry", reg.URL, "--token", "cpm_bad")
	if err == nil || !strings.Contains(err.Error(), "rejected the token") {
		t.Fatalf("expected a rejection, got %v", err)
	}
	if _, statErr := os.Stat(cfgPath); !os.IsNotExist(statErr) {
		t.Fatal("a rejected token must not be saved")
	}
}

func TestLoginWithEmptyInputFails(t *testing.T) {
	isolate(t)
	reg := newFakeRegistry(t)
	_, _, err := run(t, "\n", "login", "--registry", reg.URL)
	if err == nil || !strings.Contains(err.Error(), "no token given") {
		t.Fatalf("expected no-token error, got %v", err)
	}
}

func TestWhoamiUsesSavedLogin(t *testing.T) {
	isolate(t)
	reg := newFakeRegistry(t)
	if _, _, err := run(t, "", "login", "--registry", reg.URL, "--token", "cpm_good"); err != nil {
		t.Fatal(err)
	}
	out, _, err := run(t, "", "whoami", "--registry", reg.URL)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"Alice (u1)", "Registry: " + reg.URL, `token "laptop", expires 2026-12-01 (from config file)`, "Scopes:   publish"} {
		if !strings.Contains(out, want) {
			t.Errorf("whoami output missing %q:\n%s", want, out)
		}
	}
}

func TestWhoamiWithoutLoginExplainsHow(t *testing.T) {
	isolate(t)
	reg := newFakeRegistry(t)
	_, _, err := run(t, "", "whoami", "--registry", reg.URL)
	if err == nil || !strings.Contains(err.Error(), "cpm login") || !strings.Contains(err.Error(), envToken) {
		t.Fatalf("expected not-logged-in guidance, got %v", err)
	}
}

func TestEnvironmentTokenWinsOverSavedLogin(t *testing.T) {
	isolate(t)
	reg := newFakeRegistry(t)
	if _, _, err := run(t, "", "login", "--registry", reg.URL, "--token", "cpm_good"); err != nil {
		t.Fatal(err)
	}
	t.Setenv(envToken, "cpm_bad")
	t.Setenv(envRegistry, reg.URL)
	_, _, err := run(t, "", "whoami")
	if err == nil || !strings.Contains(err.Error(), "rejected the token") {
		t.Fatalf("expected the env token to be used and rejected, got %v", err)
	}
	out, _, err := run(t, "", "whoami", "--token", "cpm_good")
	if err != nil || !strings.Contains(out, "(from --token)") {
		t.Fatalf("expected the flag to win: %v %q", err, out)
	}
}

func TestLogout(t *testing.T) {
	cfgPath := isolate(t)
	reg := newFakeRegistry(t)
	if _, _, err := run(t, "", "login", "--registry", reg.URL, "--token", "cpm_good"); err != nil {
		t.Fatal(err)
	}
	out, _, err := run(t, "", "logout", "--registry", reg.URL)
	if err != nil || !strings.Contains(out, "Logged out of "+reg.URL) {
		t.Fatalf("logout: %v %q", err, out)
	}
	cfg, _ := config.Load(cfgPath)
	if cfg.Token(reg.URL) != "" {
		t.Fatal("token still saved after logout")
	}
	out, _, err = run(t, "", "logout", "--registry", reg.URL)
	if err != nil || !strings.Contains(out, "nothing to do") {
		t.Fatalf("second logout: %v %q", err, out)
	}
}

func TestPackWritesTarballIntoDist(t *testing.T) {
	isolate(t)
	dir := packageDir(t)
	out, _, err := run(t, "", "pack", "--dir", dir)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "demo-1.0.0.tgz (3 files") {
		t.Fatalf("output = %q", out)
	}
	if _, err := os.Stat(filepath.Join(dir, "dist", "demo-1.0.0.tgz")); err != nil {
		t.Fatal(err)
	}
}

func TestPackReportsManifestProblems(t *testing.T) {
	isolate(t)
	dir := t.TempDir()
	_, _, err := run(t, "", "pack", "--dir", dir)
	if err == nil || !strings.Contains(err.Error(), "no cpm.json") {
		t.Fatalf("expected a manifest error, got %v", err)
	}
}

func TestPublishUploadsAndTreatsConflictAsSuccess(t *testing.T) {
	isolate(t)
	reg := newFakeRegistry(t)
	dir := packageDir(t)
	t.Setenv(envToken, "cpm_good")

	out, _, err := run(t, "", "publish", "--dir", dir, "--registry", reg.URL)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "Published demo@1.0.0 to "+reg.URL) {
		t.Fatalf("output = %q", out)
	}
	if _, ok := reg.published["demo-1.0.0.tgz"]; !ok {
		t.Fatalf("registry received %v", reg.published)
	}

	out, _, err = run(t, "", "publish", "--dir", dir, "--registry", reg.URL)
	if err != nil {
		t.Fatalf("a re-publish must succeed, got %v", err)
	}
	if !strings.Contains(out, "demo@1.0.0 is already published") {
		t.Fatalf("output = %q", out)
	}
}

func TestPublishWithoutCredentialFailsBeforePacking(t *testing.T) {
	isolate(t)
	reg := newFakeRegistry(t)
	// No cpm.json here: a credential error must come first.
	_, _, err := run(t, "", "publish", "--dir", t.TempDir(), "--registry", reg.URL)
	if err == nil || !strings.Contains(err.Error(), "not logged in") {
		t.Fatalf("expected a not-logged-in error, got %v", err)
	}
}

func TestPublishSurfacesRegistryRejections(t *testing.T) {
	isolate(t)
	reg := newFakeRegistry(t)
	dir := packageDir(t)
	_, _, err := run(t, "", "publish", "--dir", dir, "--registry", reg.URL, "--token", "cpm_bad")
	if err == nil || !strings.Contains(err.Error(), "publishing demo@1.0.0") || !strings.Contains(err.Error(), "Invalid or expired token") {
		t.Fatalf("expected the registry's message, got %v", err)
	}
}

func TestVersionFlag(t *testing.T) {
	out, _, err := run(t, "", "--version")
	if err != nil {
		t.Fatal(err)
	}
	var pkg struct {
		Version string `json:"version"`
	}
	raw, err := os.ReadFile(filepath.Join("..", "..", "package.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(raw, &pkg); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, pkg.Version) {
		t.Fatalf("--version printed %q, package.json says %q", out, pkg.Version)
	}
}
