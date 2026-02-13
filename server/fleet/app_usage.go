package fleet

import "time"

// AppUsageEntry represents a single app usage record for a host on a specific date.
type AppUsageEntry struct {
	ID               uint      `json:"-" db:"id"`
	HostID           uint      `json:"host_id" db:"host_id"`
	BundleIdentifier string    `json:"bundle_identifier" db:"bundle_identifier"`
	AppName          string    `json:"app_name" db:"app_name"`
	ActiveSeconds    uint64    `json:"active_seconds" db:"active_seconds"`
	UsageDate        time.Time `json:"usage_date" db:"usage_date"`
}

// AppUsageAggregate represents aggregated app usage data across multiple hosts.
type AppUsageAggregate struct {
	BundleIdentifier  string  `json:"bundle_identifier" db:"bundle_identifier"`
	AppName           string  `json:"app_name" db:"app_name"`
	TotalSeconds      uint64  `json:"total_seconds" db:"total_seconds"`
	HostCount         uint    `json:"host_count" db:"host_count"`
	AvgSecondsPerHost float64 `json:"avg_seconds_per_host" db:"avg_seconds_per_host"`
}

// AppUsageListOptions specifies filters for listing app usage per host.
type AppUsageListOptions struct {
	ListOptions ListOptions `url:"list_options"`
	StartDate   string      `query:"start_date,optional"`
	EndDate     string      `query:"end_date,optional"`
}

// AppUsageAggregateOptions specifies filters for fleet-wide aggregated app usage.
type AppUsageAggregateOptions struct {
	ListOptions ListOptions `url:"list_options"`
	TeamID      *uint       `query:"team_id,optional"`
	StartDate   string      `query:"start_date,optional"`
	EndDate     string      `query:"end_date,optional"`
}
