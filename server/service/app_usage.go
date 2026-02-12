package service

import (
	"context"

	"github.com/fleetdm/fleet/v4/server/fleet"
)

// Host app usage endpoint

type getHostAppUsageRequest struct {
	ID uint `url:"id"`
	fleet.AppUsageListOptions
}

type getHostAppUsageResponse struct {
	AppUsage []fleet.AppUsageEntry     `json:"app_usage"`
	Meta     *fleet.PaginationMetadata `json:"meta,omitempty"`
	Err      error                     `json:"error,omitempty"`
}

func (r getHostAppUsageResponse) Error() error { return r.Err }

func getHostAppUsageEndpoint(ctx context.Context, request interface{}, svc fleet.Service) (fleet.Errorer, error) {
	req := request.(*getHostAppUsageRequest)
	req.ListOptions.IncludeMetadata = true

	entries, meta, err := svc.GetHostAppUsage(ctx, req.ID, req.AppUsageListOptions)
	if err != nil {
		return getHostAppUsageResponse{Err: err}, nil
	}
	if entries == nil {
		entries = []fleet.AppUsageEntry{}
	}
	return getHostAppUsageResponse{AppUsage: entries, Meta: meta}, nil
}

func (svc *Service) GetHostAppUsage(ctx context.Context, hostID uint, opts fleet.AppUsageListOptions) ([]fleet.AppUsageEntry, *fleet.PaginationMetadata, error) {
	if err := svc.authz.Authorize(ctx, &fleet.Host{}, fleet.ActionRead); err != nil {
		return nil, nil, err
	}

	entries, meta, err := svc.ds.ListHostAppUsage(ctx, hostID, opts)
	if err != nil {
		return nil, nil, err
	}

	return entries, meta, nil
}

// Fleet-wide aggregated app usage endpoint

type getAppUsageRequest struct {
	fleet.AppUsageAggregateOptions
}

type getAppUsageResponse struct {
	AppUsage []fleet.AppUsageAggregate `json:"app_usage"`
	Meta     *fleet.PaginationMetadata `json:"meta,omitempty"`
	Err      error                     `json:"error,omitempty"`
}

func (r getAppUsageResponse) Error() error { return r.Err }

func getAppUsageEndpoint(ctx context.Context, request interface{}, svc fleet.Service) (fleet.Errorer, error) {
	req := request.(*getAppUsageRequest)
	req.ListOptions.IncludeMetadata = true

	aggregates, meta, err := svc.GetAppUsage(ctx, req.AppUsageAggregateOptions)
	if err != nil {
		return getAppUsageResponse{Err: err}, nil
	}
	if aggregates == nil {
		aggregates = []fleet.AppUsageAggregate{}
	}
	return getAppUsageResponse{AppUsage: aggregates, Meta: meta}, nil
}

func (svc *Service) GetAppUsage(ctx context.Context, opts fleet.AppUsageAggregateOptions) ([]fleet.AppUsageAggregate, *fleet.PaginationMetadata, error) {
	if err := svc.authz.Authorize(ctx, &fleet.AuthzSoftwareInventory{
		TeamID: opts.TeamID,
	}, fleet.ActionRead); err != nil {
		return nil, nil, err
	}

	aggregates, meta, err := svc.ds.AggregateAppUsage(ctx, opts)
	if err != nil {
		return nil, nil, err
	}

	return aggregates, meta, nil
}
