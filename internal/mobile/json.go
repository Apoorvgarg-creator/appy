package mobile

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"unicode/utf8"
)

func readObject(w http.ResponseWriter, r *http.Request, allowed, required []string, into any) bool {
	media, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if len(r.Header.Values("Content-Type")) != 1 || err != nil || media != "application/json" || len(params) > 1 || len(params) == 1 && !strings.EqualFold(params["charset"], "utf-8") {
		reject(w, 415, "unsupported_media_type", "Send application/json with UTF-8 encoding.")
		return false
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 2<<10))
	if err != nil {
		var large *http.MaxBytesError
		if errors.As(err, &large) {
			reject(w, 413, "body_too_large", "Request body exceeds 2 KiB.")
		} else {
			reject(w, 400, "invalid_body", "Unable to read request body.")
		}
		return false
	}
	if strictObject(body, allowed, required, into) != nil {
		reject(w, 400, "invalid_request", "Send only the required, correctly typed JSON fields.")
		return false
	}
	return true
}

func strictObject(body []byte, allowed, required []string, into any) error {
	if !utf8.Valid(body) {
		return errors.New("invalid UTF-8")
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	token, err := dec.Token()
	if err != nil || token != json.Delim('{') {
		return errors.New("expected object")
	}
	seen, accepted := map[string]bool{}, map[string]bool{}
	for _, key := range allowed {
		accepted[key] = true
	}
	for dec.More() {
		token, err = dec.Token()
		if err != nil {
			return err
		}
		key, ok := token.(string)
		if !ok || !accepted[key] || seen[key] {
			return errors.New("unknown or duplicate field")
		}
		seen[key] = true
		var value json.RawMessage
		if err = dec.Decode(&value); err != nil {
			return err
		}
		if bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return errors.New("null is not accepted")
		}
	}
	if _, err = dec.Token(); err != nil {
		return err
	}
	if err = dec.Decode(new(any)); err != io.EOF {
		return errors.New("trailing data")
	}
	for _, key := range required {
		if !seen[key] {
			return errors.New("required field missing")
		}
	}
	return json.Unmarshal(body, into)
}
