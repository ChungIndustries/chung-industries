// Package registry is the HTTP client for the cpm registry: the endpoints the
// tool uses, built around the data types generated from the registry's
// OpenAPI spec (types.gen.go, see oapi-codegen.yaml).
package registry

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
	"time"
)

// DefaultURL is the official registry, used when neither the --registry flag
// nor CPM_REGISTRY_URL names one.
const DefaultURL = "https://registry.cpm.chungindustries.com"

// Client talks to one registry with one credential.
type Client struct {
	BaseURL   string
	Token     string
	UserAgent string
	HTTP      *http.Client
}

// NewClient returns a client for the registry at baseURL. An empty token
// makes anonymous requests.
func NewClient(baseURL, token, userAgent string) *Client {
	return &Client{
		BaseURL:   NormalizeURL(baseURL),
		Token:     token,
		UserAgent: userAgent,
		HTTP:      &http.Client{Timeout: 60 * time.Second},
	}
}

// NormalizeURL strips trailing slashes so URLs compare and join predictably.
func NormalizeURL(u string) string {
	return strings.TrimRight(strings.TrimSpace(u), "/")
}

// Error is a non-2xx registry response: the JSend message when the body
// carries one, otherwise the raw body (or the status text when it is empty).
type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s (HTTP %d)", e.Message, e.Status)
}

// IsStatus reports whether err is a registry Error with the given HTTP status.
func IsStatus(err error, status int) bool {
	var re *Error
	return errors.As(err, &re) && re.Status == status
}

// Me resolves the client's credential to the account behind it (GET /me).
func (c *Client) Me(ctx context.Context) (*Actor, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/me", nil)
	if err != nil {
		return nil, err
	}
	var actor Actor
	if err := c.do(req, &actor); err != nil {
		return nil, err
	}
	return &actor, nil
}

// Publish uploads a package tarball (POST /packages). The registry reads the
// name, version, and dependencies from the cpm.json at the tarball root. An
// already-published version comes back as an Error with status 409.
func (c *Client) Publish(ctx context.Context, filename string, tarball []byte) (*Package, error) {
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	header := textproto.MIMEHeader{}
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="tarball"; filename="%s"`, filename))
	header.Set("Content-Type", "application/gzip")
	part, err := form.CreatePart(header)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(tarball); err != nil {
		return nil, err
	}
	if err := form.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/packages", &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", form.FormDataContentType())
	var pkg Package
	if err := c.do(req, &pkg); err != nil {
		return nil, err
	}
	return &pkg, nil
}

// envelope is the registry's JSend response shape.
type envelope struct {
	Status  string          `json:"status"`
	Data    json.RawMessage `json:"data"`
	Message string          `json:"message"`
}

// do sends the request with the client's credential and decodes a successful
// JSend response's data into out. Any non-2xx status becomes an *Error.
func (c *Client) do(req *http.Request, out any) error {
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	if c.UserAgent != "" {
		req.Header.Set("User-Agent", c.UserAgent)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("request to %s failed: %w", c.BaseURL, err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading the response from %s: %w", c.BaseURL, err)
	}

	var env envelope
	decoded := json.Unmarshal(raw, &env) == nil

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &Error{Status: resp.StatusCode, Message: failureMessage(resp, raw, env, decoded)}
	}
	if !decoded || env.Status != "success" {
		return fmt.Errorf("unexpected response from %s: %s", c.BaseURL, snippet(raw))
	}
	if out == nil || len(env.Data) == 0 {
		return nil
	}
	if err := json.Unmarshal(env.Data, out); err != nil {
		return fmt.Errorf("unexpected response shape from %s: %w", c.BaseURL, err)
	}
	return nil
}

// failureMessage picks the most specific message available for a failed
// response: JSend fail data.message, JSend error message, then the raw body.
func failureMessage(resp *http.Response, raw []byte, env envelope, decoded bool) string {
	if decoded {
		switch env.Status {
		case "fail":
			var data struct {
				Message string `json:"message"`
			}
			if json.Unmarshal(env.Data, &data) == nil && data.Message != "" {
				return data.Message
			}
		case "error":
			if env.Message != "" {
				return env.Message
			}
		}
	}
	if text := snippet(raw); text != "" {
		return text
	}
	return http.StatusText(resp.StatusCode)
}

// snippet keeps error output readable when a body is unexpectedly large.
func snippet(raw []byte) string {
	const limit = 512
	text := strings.TrimSpace(string(raw))
	if len(text) > limit {
		return text[:limit] + "..."
	}
	return text
}
