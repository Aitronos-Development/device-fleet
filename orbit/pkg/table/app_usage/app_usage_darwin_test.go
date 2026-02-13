//go:build darwin
// +build darwin

package app_usage

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseDbOutput(t *testing.T) {
	tests := []struct {
		name     string
		input    []byte
		expected [][]string
	}{
		{
			name:     "empty output",
			input:    []byte(""),
			expected: nil,
		},
		{
			name:     "single newline",
			input:    []byte("\n"),
			expected: nil,
		},
		{
			name:  "single row",
			input: []byte("com.apple.Safari|2026-02-11|3600\n"),
			expected: [][]string{
				{"com.apple.Safari", "2026-02-11", "3600"},
			},
		},
		{
			name:  "multiple rows",
			input: []byte("com.apple.Safari|2026-02-11|3600\ncom.apple.mail|2026-02-11|1800\ncom.microsoft.VSCode|2026-02-10|7200\n"),
			expected: [][]string{
				{"com.apple.Safari", "2026-02-11", "3600"},
				{"com.apple.mail", "2026-02-11", "1800"},
				{"com.microsoft.VSCode", "2026-02-10", "7200"},
			},
		},
		{
			name:     "malformed row (wrong column count) is skipped",
			input:    []byte("com.apple.Safari|2026-02-11\ncom.apple.mail|2026-02-11|1800\n"),
			expected: [][]string{
				{"com.apple.mail", "2026-02-11", "1800"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseDbOutput(tt.input)
			if tt.expected == nil {
				assert.Empty(t, result)
			} else {
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestBuildTableRows(t *testing.T) {
	parsedRows := [][]string{
		{"com.apple.Safari", "2026-02-11", "3600"},
		{"com.apple.mail", "2026-02-11", "1800"},
	}

	rows := buildTableRows(parsedRows)
	require.Len(t, rows, 2)

	assert.Equal(t, "com.apple.Safari", rows[0]["bundle_identifier"])
	assert.Equal(t, "2026-02-11", rows[0]["usage_date"])
	assert.Equal(t, "3600", rows[0]["active_seconds"])

	assert.Equal(t, "com.apple.mail", rows[1]["bundle_identifier"])
	assert.Equal(t, "2026-02-11", rows[1]["usage_date"])
	assert.Equal(t, "1800", rows[1]["active_seconds"])
}

func TestColumns(t *testing.T) {
	cols := Columns()
	require.Len(t, cols, 3)
	assert.Equal(t, "bundle_identifier", cols[0].Name)
	assert.Equal(t, "usage_date", cols[1].Name)
	assert.Equal(t, "active_seconds", cols[2].Name)
}
