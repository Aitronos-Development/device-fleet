package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path"
	"strings"

	"github.com/fleetdm/fleet/v4/ee/maintained-apps/ingesters/homebrew"
	kitlog "github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

type createOptions struct {
	token       string
	category    string
	bundleID    string
	format      string
	name        string
	description string
}

func createApp(ctx context.Context, logger kitlog.Logger, opts createOptions) error {
	if opts.token == "" {
		return fmt.Errorf("--create requires a homebrew cask token")
	}

	if opts.category != "" {
		if _, ok := allowedCategories[opts.category]; !ok {
			return fmt.Errorf("invalid category %q (allowed: %s)", opts.category, allowedCategoriesString())
		}
	} else {
		return fmt.Errorf("--category is required (allowed: %s)", allowedCategoriesString())
	}

	slug := fmt.Sprintf("%s/darwin", opts.token)
	inputPath := path.Join("ee/maintained-apps/inputs/homebrew", opts.token+".json")

	if _, err := os.Stat(inputPath); err == nil {
		return fmt.Errorf("input file already exists at %s; use --slug to re-ingest", inputPath)
	}

	level.Info(logger).Log("msg", "fetching cask info from Homebrew API", "token", opts.token)
	caskInfo, err := homebrew.FetchCaskInfo(ctx, opts.token)
	if err != nil {
		return fmt.Errorf("fetching cask info: %w", err)
	}

	// Use auto-detected values unless overridden
	appName := caskInfo.Name
	if opts.name != "" {
		appName = opts.name
	}
	if appName == "" {
		return fmt.Errorf("could not determine app name from Homebrew API; provide --name")
	}

	description := caskInfo.Description
	if opts.description != "" {
		description = opts.description
	}

	installerFormat := caskInfo.InstallerFormat
	if opts.format != "" {
		installerFormat = opts.format
	}
	if installerFormat == "" {
		return fmt.Errorf("could not auto-detect installer format from URL %q; provide --format (dmg, zip, or pkg)", caskInfo.URL)
	}

	// Detect bundle ID
	bundleID := opts.bundleID
	if bundleID == "" {
		bundleID = detectBundleID(caskInfo.AppNames)
	}
	if bundleID == "" {
		return fmt.Errorf("could not auto-detect bundle ID; provide --bundle-id")
	}

	// Write input JSON
	inputData := map[string]any{
		"name":               appName,
		"unique_identifier":  bundleID,
		"token":              opts.token,
		"installer_format":   installerFormat,
		"slug":               slug,
		"default_categories": []string{opts.category},
	}

	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(inputData); err != nil {
		return fmt.Errorf("marshaling input JSON: %w", err)
	}

	if err := os.WriteFile(inputPath, buf.Bytes(), 0o644); err != nil {
		return fmt.Errorf("writing input file: %w", err)
	}
	level.Info(logger).Log("msg", "created input file", "path", inputPath)

	// Run ingestion using existing flow
	apps, err := homebrew.IngestApps(ctx, logger, "ee/maintained-apps/inputs/homebrew", slug)
	if err != nil {
		// Clean up input file on failure
		os.Remove(inputPath)
		return fmt.Errorf("ingesting app: %w", err)
	}

	for _, app := range apps {
		if app.IsEmpty() {
			level.Info(logger).Log("msg", "skipping manifest update due to empty output", "slug", app.Slug)
			continue
		}

		// Set description so it gets passed through to apps.json
		if description != "" {
			app.Description = fmt.Sprintf("%s is %s.", appName, withLowerFirst(description))
		}

		if err := processOutput(ctx, app); err != nil {
			return fmt.Errorf("processing output: %w", err)
		}
	}

	// Print summary
	fmt.Println()
	fmt.Println("=== Created successfully ===")
	fmt.Println()
	fmt.Printf("  Input:   %s\n", inputPath)
	fmt.Printf("  Output:  ee/maintained-apps/outputs/%s/darwin.json\n", opts.token)
	fmt.Printf("  Catalog: ee/maintained-apps/outputs/apps.json\n")
	fmt.Println()

	if len(caskInfo.AppNames) > 0 {
		appPath := fmt.Sprintf("/Applications/%s", caskInfo.AppNames[0])
		fmt.Println("Next step - generate icons:")
		fmt.Printf("  bash tools/software/icons/generate-icons.sh -s \"%s\" -a \"%s\"\n", slug, appPath)
	} else {
		fmt.Println("Next step - generate icons:")
		fmt.Printf("  bash tools/software/icons/generate-icons.sh -s \"%s\" -i \"/path/to/icon.png\"\n", slug)
	}
	fmt.Println()

	return nil
}

// withLowerFirst lowercases the first character of a string.
func withLowerFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToLower(s[:1]) + s[1:]
}

// detectBundleID tries to find the bundle ID from locally installed apps.
func detectBundleID(appNames []string) string {
	for _, appName := range appNames {
		appPath := fmt.Sprintf("/Applications/%s", appName)
		plistPath := path.Join(appPath, "Contents", "Info.plist")

		if _, err := os.Stat(plistPath); err != nil {
			continue
		}

		out, err := exec.Command("plutil", "-extract", "CFBundleIdentifier", "raw", plistPath).Output()
		if err != nil {
			continue
		}

		bundleID := strings.TrimSpace(string(out))
		if bundleID != "" {
			return bundleID
		}
	}
	return ""
}
