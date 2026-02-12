//go:build darwin
// +build darwin

package app_usage

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/osquery/osquery-go/plugin/table"
	"github.com/rs/zerolog/log"
)

var (
	// knowledgeC.db is where macOS stores app usage data (used by Screen Time).
	// The system-level database contains usage data for all users.
	knowledgeCDBPath = "/private/var/db/CoreDuet/Knowledge/knowledgeC.db"

	// Query aggregates foreground app usage by bundle identifier and date.
	// Mac Absolute Time epoch is 2001-01-01, so we add 978307200 to convert to Unix epoch.
	dbQuery = `SELECT
    ZOBJECT.ZVALUESTRING,
    date(ZOBJECT.ZSTARTDATE + 978307200, 'unixepoch', 'localtime'),
    CAST(SUM(ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) AS INTEGER)
FROM ZOBJECT
WHERE ZSTREAMNAME = '/app/usage'
  AND ZOBJECT.ZENDDATE IS NOT NULL
  AND ZOBJECT.ZSTARTDATE IS NOT NULL
  AND ZOBJECT.ZVALUESTRING IS NOT NULL
  AND (ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) > 0
GROUP BY ZOBJECT.ZVALUESTRING, date(ZOBJECT.ZSTARTDATE + 978307200, 'unixepoch', 'localtime')
ORDER BY SUM(ZOBJECT.ZENDDATE - ZOBJECT.ZSTARTDATE) DESC;`

	sqlite3Path = "/usr/bin/sqlite3"
	dbColNames  = []string{"bundle_identifier", "usage_date", "active_seconds"}
)

// Columns is the schema of the app_usage table.
func Columns() []table.ColumnDefinition {
	return []table.ColumnDefinition{
		table.TextColumn("bundle_identifier"),
		table.TextColumn("usage_date"),
		table.BigIntColumn("active_seconds"),
	}
}

// Generate is called to return the results for the table at query time.
func Generate(ctx context.Context, queryContext table.QueryContext) ([]map[string]string, error) {
	if _, err := os.Stat(knowledgeCDBPath); err != nil {
		if os.IsNotExist(err) {
			log.Debug().Msg("knowledgeC.db not found, app_usage table returning empty results")
			return nil, nil
		}
		return nil, fmt.Errorf("app_usage: checking knowledgeC.db: %w", err)
	}

	rows, err := queryKnowledgeDB()
	if err != nil {
		log.Debug().Err(err).Msg("app_usage: failed to query knowledgeC.db")
		return nil, nil
	}

	return rows, nil
}

func queryKnowledgeDB() ([]map[string]string, error) {
	// Open in read-only mode to avoid lock contention with the OS.
	cmd := exec.Command(sqlite3Path, "-readonly", knowledgeCDBPath, dbQuery)
	var dbOut bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &dbOut
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("sqlite3 query failed: %s: %w", stderr.String(), err)
	}

	parsedRows := parseDbOutput(dbOut.Bytes())
	return buildTableRows(parsedRows), nil
}

func parseDbOutput(dbOut []byte) [][]string {
	rawRows := strings.Split(string(dbOut), "\n")
	n := len(rawRows)
	if n == 0 {
		return nil
	}
	// sqlite3 output ends with "\n", making the final row empty
	if rawRows[n-1] == "" {
		rawRows = rawRows[:n-1]
	}

	parsedRows := make([][]string, 0, len(rawRows))
	for _, rawRow := range rawRows {
		cols := strings.Split(rawRow, "|")
		if len(cols) == len(dbColNames) {
			parsedRows = append(parsedRows, cols)
		}
	}
	return parsedRows
}

func buildTableRows(parsedRows [][]string) []map[string]string {
	rows := make([]map[string]string, 0, len(parsedRows))
	for _, parsedRow := range parsedRows {
		row := make(map[string]string, len(dbColNames))
		for i, colVal := range parsedRow {
			row[dbColNames[i]] = colVal
		}
		rows = append(rows, row)
	}
	return rows
}
