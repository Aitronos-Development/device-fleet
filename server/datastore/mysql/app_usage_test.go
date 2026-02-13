package mysql

import (
	"context"
	"testing"
	"time"

	"github.com/fleetdm/fleet/v4/server/fleet"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAppUsage(t *testing.T) {
	ds := CreateMySQLDS(t)

	cases := []struct {
		name string
		fn   func(t *testing.T, ds *Datastore)
	}{
		{"ReplaceHostAppUsage", testReplaceHostAppUsage},
		{"ListHostAppUsage", testListHostAppUsage},
		{"AggregateAppUsage", testAggregateAppUsage},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			defer TruncateTables(t, ds)
			c.fn(t, ds)
		})
	}
}

func testReplaceHostAppUsage(t *testing.T, ds *Datastore) {
	ctx := context.Background()

	host, err := ds.NewHost(ctx, &fleet.Host{
		OsqueryHostID:  ptr("host1"),
		NodeKey:        ptr("key1"),
		DetailUpdatedAt: time.Now(),
		LabelUpdatedAt:  time.Now(),
		PolicyUpdatedAt: time.Now(),
		SeenTime:        time.Now(),
	})
	require.NoError(t, err)

	date := time.Date(2026, 2, 11, 0, 0, 0, 0, time.UTC)
	entries := []fleet.AppUsageEntry{
		{BundleIdentifier: "com.apple.Safari", AppName: "Safari", ActiveSeconds: 3600, UsageDate: date},
		{BundleIdentifier: "com.apple.mail", AppName: "Mail", ActiveSeconds: 1800, UsageDate: date},
	}

	err = ds.ReplaceHostAppUsage(ctx, host.ID, entries)
	require.NoError(t, err)

	// Verify data was inserted
	results, _, err := ds.ListHostAppUsage(ctx, host.ID, fleet.AppUsageListOptions{})
	require.NoError(t, err)
	require.Len(t, results, 2)

	// Replace with updated values (upsert)
	entries[0].ActiveSeconds = 7200
	err = ds.ReplaceHostAppUsage(ctx, host.ID, entries)
	require.NoError(t, err)

	results, _, err = ds.ListHostAppUsage(ctx, host.ID, fleet.AppUsageListOptions{})
	require.NoError(t, err)
	require.Len(t, results, 2)

	// Find Safari entry and verify seconds were replaced
	for _, r := range results {
		if r.BundleIdentifier == "com.apple.Safari" {
			assert.Equal(t, uint64(7200), r.ActiveSeconds)
		}
	}
}

func testListHostAppUsage(t *testing.T, ds *Datastore) {
	ctx := context.Background()

	host, err := ds.NewHost(ctx, &fleet.Host{
		OsqueryHostID:  ptr("host2"),
		NodeKey:        ptr("key2"),
		DetailUpdatedAt: time.Now(),
		LabelUpdatedAt:  time.Now(),
		PolicyUpdatedAt: time.Now(),
		SeenTime:        time.Now(),
	})
	require.NoError(t, err)

	date1 := time.Date(2026, 2, 10, 0, 0, 0, 0, time.UTC)
	date2 := time.Date(2026, 2, 11, 0, 0, 0, 0, time.UTC)

	entries := []fleet.AppUsageEntry{
		{BundleIdentifier: "com.apple.Safari", AppName: "Safari", ActiveSeconds: 3600, UsageDate: date1},
		{BundleIdentifier: "com.apple.Safari", AppName: "Safari", ActiveSeconds: 1800, UsageDate: date2},
		{BundleIdentifier: "com.apple.mail", AppName: "Mail", ActiveSeconds: 900, UsageDate: date2},
	}

	err = ds.ReplaceHostAppUsage(ctx, host.ID, entries)
	require.NoError(t, err)

	// List with date filter
	results, _, err := ds.ListHostAppUsage(ctx, host.ID, fleet.AppUsageListOptions{
		StartDate: "2026-02-11",
	})
	require.NoError(t, err)
	assert.Len(t, results, 2) // Safari + Mail on Feb 11

	// List all
	results, _, err = ds.ListHostAppUsage(ctx, host.ID, fleet.AppUsageListOptions{})
	require.NoError(t, err)
	assert.Len(t, results, 3)

	// Empty for non-existent host
	results, _, err = ds.ListHostAppUsage(ctx, 99999, fleet.AppUsageListOptions{})
	require.NoError(t, err)
	assert.Len(t, results, 0)
}

func testAggregateAppUsage(t *testing.T, ds *Datastore) {
	ctx := context.Background()

	host1, err := ds.NewHost(ctx, &fleet.Host{
		OsqueryHostID:  ptr("host3"),
		NodeKey:        ptr("key3"),
		DetailUpdatedAt: time.Now(),
		LabelUpdatedAt:  time.Now(),
		PolicyUpdatedAt: time.Now(),
		SeenTime:        time.Now(),
	})
	require.NoError(t, err)

	host2, err := ds.NewHost(ctx, &fleet.Host{
		OsqueryHostID:  ptr("host4"),
		NodeKey:        ptr("key4"),
		DetailUpdatedAt: time.Now(),
		LabelUpdatedAt:  time.Now(),
		PolicyUpdatedAt: time.Now(),
		SeenTime:        time.Now(),
	})
	require.NoError(t, err)

	date := time.Date(2026, 2, 11, 0, 0, 0, 0, time.UTC)

	// Host 1: Safari 1h, Mail 30m
	err = ds.ReplaceHostAppUsage(ctx, host1.ID, []fleet.AppUsageEntry{
		{BundleIdentifier: "com.apple.Safari", AppName: "Safari", ActiveSeconds: 3600, UsageDate: date},
		{BundleIdentifier: "com.apple.mail", AppName: "Mail", ActiveSeconds: 1800, UsageDate: date},
	})
	require.NoError(t, err)

	// Host 2: Safari 2h
	err = ds.ReplaceHostAppUsage(ctx, host2.ID, []fleet.AppUsageEntry{
		{BundleIdentifier: "com.apple.Safari", AppName: "Safari", ActiveSeconds: 7200, UsageDate: date},
	})
	require.NoError(t, err)

	// Aggregate across all hosts
	aggregates, _, err := ds.AggregateAppUsage(ctx, fleet.AppUsageAggregateOptions{})
	require.NoError(t, err)
	require.True(t, len(aggregates) >= 2)

	// Find Safari aggregate
	for _, agg := range aggregates {
		if agg.BundleIdentifier == "com.apple.Safari" {
			assert.Equal(t, uint64(10800), agg.TotalSeconds) // 3600 + 7200
			assert.Equal(t, uint(2), agg.HostCount)
			assert.Equal(t, float64(5400), agg.AvgSecondsPerHost)
		}
		if agg.BundleIdentifier == "com.apple.mail" {
			assert.Equal(t, uint64(1800), agg.TotalSeconds)
			assert.Equal(t, uint(1), agg.HostCount)
		}
	}
}

func ptr(s string) *string {
	return &s
}
