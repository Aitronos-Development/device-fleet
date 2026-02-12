package mysql

import (
	"context"
	"fmt"
	"strings"

	"github.com/fleetdm/fleet/v4/server/contexts/ctxerr"
	"github.com/fleetdm/fleet/v4/server/fleet"
	"github.com/jmoiron/sqlx"
)

func (ds *Datastore) ReplaceHostAppUsage(ctx context.Context, hostID uint, entries []fleet.AppUsageEntry) error {
	if len(entries) == 0 {
		return nil
	}

	// Batch upsert: replace active_seconds since knowledgeC.db provides the authoritative total.
	const batchSize = 500
	for i := 0; i < len(entries); i += batchSize {
		end := i + batchSize
		if end > len(entries) {
			end = len(entries)
		}
		batch := entries[i:end]

		valueStrings := make([]string, 0, len(batch))
		valueArgs := make([]interface{}, 0, len(batch)*5)
		for _, e := range batch {
			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?)")
			valueArgs = append(valueArgs, hostID, e.BundleIdentifier, e.AppName, e.ActiveSeconds, e.UsageDate)
		}

		stmt := fmt.Sprintf(`
			INSERT INTO host_app_usage
				(host_id, bundle_identifier, app_name, active_seconds, usage_date)
			VALUES %s
			ON DUPLICATE KEY UPDATE
				active_seconds = VALUES(active_seconds),
				app_name = VALUES(app_name)`,
			strings.Join(valueStrings, ","))

		if _, err := ds.writer(ctx).ExecContext(ctx, stmt, valueArgs...); err != nil {
			return ctxerr.Wrap(ctx, err, "replace host app usage")
		}
	}

	return nil
}

func (ds *Datastore) ListHostAppUsage(ctx context.Context, hostID uint, opts fleet.AppUsageListOptions) ([]fleet.AppUsageEntry, *fleet.PaginationMetadata, error) {
	stmt := `
		SELECT
			host_id,
			bundle_identifier,
			app_name,
			active_seconds,
			usage_date
		FROM host_app_usage
		WHERE host_id = ?`

	args := []interface{}{hostID}

	if opts.StartDate != "" {
		stmt += ` AND usage_date >= ?`
		args = append(args, opts.StartDate)
	}
	if opts.EndDate != "" {
		stmt += ` AND usage_date <= ?`
		args = append(args, opts.EndDate)
	}

	opts.ListOptions.IncludeMetadata = true
	if opts.ListOptions.OrderKey == "" {
		opts.ListOptions.OrderKey = "active_seconds"
		opts.ListOptions.OrderDirection = fleet.OrderDescending
	}

	stmt, args = appendListOptionsWithCursorToSQL(stmt, args, &opts.ListOptions)

	var entries []fleet.AppUsageEntry
	if err := sqlx.SelectContext(ctx, ds.reader(ctx), &entries, stmt, args...); err != nil {
		return nil, nil, ctxerr.Wrap(ctx, err, "list host app usage")
	}

	var metaData *fleet.PaginationMetadata
	if opts.ListOptions.IncludeMetadata {
		perPage := opts.ListOptions.PerPage
		metaData = &fleet.PaginationMetadata{HasPreviousResults: opts.ListOptions.Page > 0}
		if len(entries) > int(perPage) {
			metaData.HasNextResults = true
			entries = entries[:len(entries)-1]
		}
	}

	return entries, metaData, nil
}

func (ds *Datastore) AggregateAppUsage(ctx context.Context, opts fleet.AppUsageAggregateOptions) ([]fleet.AppUsageAggregate, *fleet.PaginationMetadata, error) {
	stmt := `
		SELECT
			hau.bundle_identifier,
			hau.app_name,
			SUM(hau.active_seconds) AS total_seconds,
			COUNT(DISTINCT hau.host_id) AS host_count,
			SUM(hau.active_seconds) / COUNT(DISTINCT hau.host_id) AS avg_seconds_per_host
		FROM host_app_usage hau`

	var args []interface{}

	if opts.TeamID != nil {
		stmt += ` JOIN hosts h ON hau.host_id = h.id WHERE h.team_id = ?`
		args = append(args, *opts.TeamID)
	} else {
		stmt += ` WHERE 1=1`
	}

	if opts.StartDate != "" {
		stmt += ` AND hau.usage_date >= ?`
		args = append(args, opts.StartDate)
	}
	if opts.EndDate != "" {
		stmt += ` AND hau.usage_date <= ?`
		args = append(args, opts.EndDate)
	}

	stmt += ` GROUP BY hau.bundle_identifier, hau.app_name`

	opts.ListOptions.IncludeMetadata = true
	if opts.ListOptions.OrderKey == "" {
		opts.ListOptions.OrderKey = "total_seconds"
		opts.ListOptions.OrderDirection = fleet.OrderDescending
	}

	stmt, args = appendListOptionsWithCursorToSQL(stmt, args, &opts.ListOptions)

	var aggregates []fleet.AppUsageAggregate
	if err := sqlx.SelectContext(ctx, ds.reader(ctx), &aggregates, stmt, args...); err != nil {
		return nil, nil, ctxerr.Wrap(ctx, err, "aggregate app usage")
	}

	var metaData *fleet.PaginationMetadata
	if opts.ListOptions.IncludeMetadata {
		perPage := opts.ListOptions.PerPage
		metaData = &fleet.PaginationMetadata{HasPreviousResults: opts.ListOptions.Page > 0}
		if len(aggregates) > int(perPage) {
			metaData.HasNextResults = true
			aggregates = aggregates[:len(aggregates)-1]
		}
	}

	return aggregates, metaData, nil
}
