#!/bin/bash
set -euo pipefail

# Add a new macOS app to the Fleet-maintained apps catalog.
# Usage: bash scripts/add-maintained-app.sh [cask-token]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

CATEGORIES=("Browsers" "Communication" "Developer tools" "Productivity" "Security" "Utilities")

# --- Step 1: Get Homebrew cask token ---

TOKEN="${1:-}"
if [[ -z "$TOKEN" ]]; then
    echo -e "${BOLD}Enter Homebrew cask token${NC} (e.g., firefox, visual-studio-code):"
    read -r TOKEN
fi

if [[ -z "$TOKEN" ]]; then
    echo -e "${RED}Error: cask token is required.${NC}"
    exit 1
fi

# Basic format validation
if [[ ! "$TOKEN" =~ ^[a-z0-9][a-z0-9+-]*$ ]]; then
    echo -e "${RED}Error: Invalid cask token format: ${TOKEN}${NC}"
    echo "Tokens should be lowercase with hyphens (e.g., visual-studio-code)"
    exit 1
fi

# --- Step 2: Check for existing input ---

INPUT_FILE="ee/maintained-apps/inputs/homebrew/${TOKEN}.json"
if [[ -f "$INPUT_FILE" ]]; then
    echo -e "${YELLOW}Input file already exists at ${INPUT_FILE}${NC}"
    echo "To re-ingest, run:"
    echo "  go run cmd/maintained-apps/main.go --slug=\"${TOKEN}/darwin\" --debug"
    exit 1
fi

# --- Step 3: Fetch from Homebrew API ---

echo ""
echo "Fetching info from Homebrew API..."

BREW_JSON=$(curl -sf "https://formulae.brew.sh/api/cask/${TOKEN}.json" 2>/dev/null) || {
    echo -e "${RED}Error: Cask '${TOKEN}' not found in Homebrew.${NC}"
    echo "Search at: https://formulae.brew.sh/cask/"
    exit 1
}

APP_NAME=$(echo "$BREW_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['name'][0])")
APP_DESC=$(echo "$BREW_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('desc','') or '')")
APP_URL=$(echo "$BREW_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['url'])")

echo ""
echo -e "${GREEN}Found: ${APP_NAME}${NC}"
echo "  Description: ${APP_DESC}"
echo "  URL: ${APP_URL}"

# --- Step 4: Auto-detect installer format ---

DETECTED_FORMAT=""
LOWER_URL=$(echo "$APP_URL" | tr '[:upper:]' '[:lower:]')
case "$LOWER_URL" in
    *.dmg) DETECTED_FORMAT="dmg" ;;
    *.zip) DETECTED_FORMAT="zip" ;;
    *.pkg) DETECTED_FORMAT="pkg" ;;
esac

echo ""
if [[ -n "$DETECTED_FORMAT" ]]; then
    echo -e "Installer format: ${GREEN}${DETECTED_FORMAT}${NC} (auto-detected from URL)"
    FORMAT="$DETECTED_FORMAT"
else
    echo -e "${YELLOW}Could not auto-detect installer format from URL.${NC}"
    echo "Select installer format:"
    select FORMAT in "dmg" "zip" "pkg"; do
        [[ -n "$FORMAT" ]] && break
    done
fi

# --- Step 5: Category selection ---

echo ""
echo "Select category:"
select CATEGORY in "${CATEGORIES[@]}"; do
    [[ -n "$CATEGORY" ]] && break
done
echo -e "Selected: ${GREEN}${CATEGORY}${NC}"

# --- Step 6: Bundle ID detection ---

echo ""
echo "Detecting bundle ID..."

# Extract app artifact name from Homebrew data
APP_ARTIFACT=$(echo "$BREW_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for a in d.get('artifacts', []):
    if 'app' in a:
        for item in a['app']:
            if isinstance(item, str):
                print(item)
                sys.exit(0)
" 2>/dev/null || echo "")

BUNDLE_ID=""
APP_PATH=""
if [[ -n "$APP_ARTIFACT" ]]; then
    APP_PATH="/Applications/${APP_ARTIFACT}"
    if [[ -d "$APP_PATH" ]]; then
        PLIST_PATH="${APP_PATH}/Contents/Info.plist"
        if [[ -f "$PLIST_PATH" ]]; then
            BUNDLE_ID=$(plutil -extract CFBundleIdentifier raw "$PLIST_PATH" 2>/dev/null || echo "")
        fi
    fi
fi

if [[ -n "$BUNDLE_ID" ]]; then
    echo -e "Auto-detected bundle ID: ${GREEN}${BUNDLE_ID}${NC}"
    echo "Press Enter to accept, or type a different bundle ID:"
    read -r USER_BUNDLE_ID
    if [[ -n "$USER_BUNDLE_ID" ]]; then
        BUNDLE_ID="$USER_BUNDLE_ID"
    fi
else
    if [[ -n "$APP_ARTIFACT" ]]; then
        echo -e "${YELLOW}App '${APP_ARTIFACT}' not found in /Applications.${NC}"
        echo "Install it first for auto-detection, or enter the bundle ID manually."
    else
        echo -e "${YELLOW}Could not determine app name from Homebrew artifacts.${NC}"
    fi
    echo "Enter bundle ID (e.g., com.example.app):"
    read -r BUNDLE_ID
    if [[ -z "$BUNDLE_ID" ]]; then
        echo -e "${RED}Error: Bundle ID is required.${NC}"
        exit 1
    fi
fi

# --- Step 7: Confirm ---

echo ""
echo -e "${BLUE}${BOLD}=== Summary ===${NC}"
echo "  Token:      ${TOKEN}"
echo "  Name:       ${APP_NAME}"
echo "  Slug:       ${TOKEN}/darwin"
echo "  Bundle ID:  ${BUNDLE_ID}"
echo "  Format:     ${FORMAT}"
echo "  Category:   ${CATEGORY}"
echo "  Description: ${APP_DESC}"
echo ""
echo "Press Enter to continue, or Ctrl+C to cancel..."
read -r

# --- Step 8: Run Go CLI ---

echo ""
echo "Creating maintained app..."
go run cmd/maintained-apps/main.go \
    --create="${TOKEN}" \
    --category="${CATEGORY}" \
    --bundle-id="${BUNDLE_ID}" \
    --format="${FORMAT}" \
    --name="${APP_NAME}" \
    --description="${APP_DESC}" \
    --debug

# --- Step 9: Icon generation ---

echo ""
echo -e "${BLUE}${BOLD}=== Icon Generation ===${NC}"

if [[ -n "$APP_PATH" && -d "$APP_PATH" ]]; then
    echo "Generating icons from ${APP_PATH}..."
    bash tools/software/icons/generate-icons.sh \
        -s "${TOKEN}/darwin" \
        -a "${APP_PATH}"
    echo -e "${GREEN}Icons generated.${NC}"
else
    echo -e "${YELLOW}App not installed locally — icon generation skipped.${NC}"
    echo ""
    echo "To generate icons later:"
    if [[ -n "$APP_ARTIFACT" ]]; then
        echo "  bash tools/software/icons/generate-icons.sh -s \"${TOKEN}/darwin\" -a \"/Applications/${APP_ARTIFACT}\""
    else
        echo "  bash tools/software/icons/generate-icons.sh -s \"${TOKEN}/darwin\" -i \"/path/to/icon.png\""
    fi
fi

# --- Step 10: Final summary ---

echo ""
echo -e "${GREEN}${BOLD}=== Done! ===${NC}"
echo ""
echo "Files created/modified:"
echo "  [new] ee/maintained-apps/inputs/homebrew/${TOKEN}.json"
echo "  [new] ee/maintained-apps/outputs/${TOKEN}/darwin.json"
echo "  [mod] ee/maintained-apps/outputs/apps.json"
if [[ -n "$APP_PATH" && -d "$APP_PATH" ]]; then
    echo "  [new] frontend/pages/SoftwarePage/components/icons/<Component>.tsx"
    echo "  [mod] frontend/pages/SoftwarePage/components/icons/index.ts"
    echo "  [new] website/assets/images/app-icon-${TOKEN}-60x60@2x.png"
fi
echo ""
echo "Next steps:"
echo "  1. Review the generated files"
echo "  2. Run: make lint"
echo "  3. Open a PR"
