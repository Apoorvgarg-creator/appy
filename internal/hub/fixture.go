package hub

import (
	"crypto/sha256"
	"embed"
	"fmt"
	"strings"
)

//go:embed fixture/*
var fixtureFS embed.FS

// fixtureReport reads only the immutable files linked into this binary.
// The task goal is a label; it is deliberately not an executable instruction.
func fixtureReport() string {
	var report strings.Builder
	report.WriteString("# Bundled example repository report\n\n")
	report.WriteString("Source: Appy's built-in Example Notes fixture.\n")
	report.WriteString("Method: deterministic file inventory; no language model or shell execution.\n\n")
	report.WriteString("## Summary\n\nThe fixture describes an in-memory notes helper. `remainingNotes` selects unfinished notes.\n")
	report.WriteString("The example test contains one completed and one unfinished note. The runner inventories these files; it does not execute the test.\n\n")
	report.WriteString("## Files\n\n| File | Lines | SHA-256 |\n| --- | ---: | --- |\n")
	entries, _ := fixtureFS.ReadDir("fixture")
	for _, entry := range entries {
		body, _ := fixtureFS.ReadFile("fixture/" + entry.Name())
		fmt.Fprintf(&report, "| %s | %d | `%x` |\n", entry.Name(), strings.Count(string(body), "\n"), sha256.Sum256(body))
	}
	report.WriteString("\n## Limits\n\nThis report covers only the bundled example. It does not assess your repository, run tests, inspect devices, or establish security assurance.\n")
	return report.String()
}
