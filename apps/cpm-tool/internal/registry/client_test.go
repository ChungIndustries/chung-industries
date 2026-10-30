package registry

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const actorJSON = `{"status":"success","data":{"userId":"u1","name":"Alice","via":"token","scopes":["publish"],"token":{"name":"laptop","expiresAt":"2026-12-01T00:00:00.000Z"}}}`

func TestMeSendsCredentialAndDecodesActor(t *testing.T) {
	var gotAuth, gotUA string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/me" {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		gotAuth = r.Header.Get("Authorization")
		gotUA = r.Header.Get("User-Agent")
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, actorJSON)
	}))
	defer srv.Close()

	client := NewClient(srv.URL+"/", "cpm_good", "cpm/test")
	actor, err := client.Me(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if gotAuth != "Bearer cpm_good" || gotUA != "cpm/test" {
		t.Fatalf("headers = %q / %q", gotAuth, gotUA)
	}
	if actor.Name != "Alice" || actor.UserId != "u1" || actor.Via != Token || actor.Token == nil || *actor.Token.Name != "laptop" {
		t.Fatalf("actor = %+v", actor)
	}
	if actor.Token.ExpiresAt == nil || actor.Token.ExpiresAt.Year() != 2026 {
		t.Fatalf("expiresAt = %v", actor.Token.ExpiresAt)
	}
}

func TestErrorsCarryTheRegistryMessage(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
		want   string
	}{
		{"jsend fail", 401, `{"status":"fail","data":{"message":"Invalid or expired token"}}`, "Invalid or expired token"},
		{"jsend error", 500, `{"status":"error","message":"Internal Server Error"}`, "Internal Server Error"},
		{"plain text", 502, "bad gateway from the edge", "bad gateway from the edge"},
		{"empty body", 503, "", "Service Unavailable"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				io.WriteString(w, tc.body)
			}))
			defer srv.Close()

			_, err := NewClient(srv.URL, "", "").Me(context.Background())
			if !IsStatus(err, tc.status) {
				t.Fatalf("expected a registry error with status %d, got %v", tc.status, err)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error = %q, want it to contain %q", err, tc.want)
			}
		})
	}
}

func TestAnonymousRequestsSendNoAuthorization(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.Header["Authorization"]; ok {
			t.Error("Authorization header sent for an anonymous client")
		}
		io.WriteString(w, actorJSON)
	}))
	defer srv.Close()
	if _, err := NewClient(srv.URL, "", "").Me(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestPublishUploadsMultipartTarball(t *testing.T) {
	tarball := []byte{0x1f, 0x8b, 1, 2, 3}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/packages" {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		file, header, err := r.FormFile("tarball")
		if err != nil {
			t.Errorf("no tarball part: %v", err)
			w.WriteHeader(400)
			return
		}
		defer file.Close()
		body, _ := io.ReadAll(file)
		if string(body) != string(tarball) || header.Filename != "demo-1.0.0.tgz" {
			t.Errorf("part = %q (%d bytes)", header.Filename, len(body))
		}
		if ct := header.Header.Get("Content-Type"); ct != "application/gzip" {
			t.Errorf("part content type = %q", ct)
		}
		w.WriteHeader(201)
		io.WriteString(w, `{"status":"success","data":{"name":"demo","createdAt":"2026-01-01T00:00:00.000Z","dist-tags":{"latest":"1.0.0"},"versions":{}}}`)
	}))
	defer srv.Close()

	pkg, err := NewClient(srv.URL, "cpm_good", "").Publish(context.Background(), "demo-1.0.0.tgz", tarball)
	if err != nil {
		t.Fatal(err)
	}
	if pkg.Name != "demo" || pkg.DistTags.Latest != "1.0.0" {
		t.Fatalf("package = %+v", pkg)
	}
}

func TestPublishConflictIsA409Error(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(409)
		io.WriteString(w, `{"status":"fail","data":{"message":"Version 1.0.0 of \"demo\" is already published and immutable"}}`)
	}))
	defer srv.Close()

	_, err := NewClient(srv.URL, "cpm_good", "").Publish(context.Background(), "demo-1.0.0.tgz", []byte("x"))
	if !IsStatus(err, 409) {
		t.Fatalf("expected a 409 registry error, got %v", err)
	}
	if IsStatus(err, 401) {
		t.Fatal("IsStatus matched the wrong status")
	}
}

func TestUnexpectedSuccessBodyIsAnError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		io.WriteString(w, "<html>not the registry</html>")
	}))
	defer srv.Close()
	_, err := NewClient(srv.URL, "", "").Me(context.Background())
	if err == nil || !strings.Contains(err.Error(), "unexpected response") {
		t.Fatalf("expected an unexpected-response error, got %v", err)
	}
}
