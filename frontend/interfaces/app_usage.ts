export interface IAppUsageEntry {
  host_id: number;
  bundle_identifier: string;
  app_name: string;
  active_seconds: number;
  usage_date: string;
}

export interface IAppUsageAggregate {
  bundle_identifier: string;
  app_name: string;
  total_seconds: number;
  host_count: number;
  avg_seconds_per_host: number;
}

export interface IGetHostAppUsageResponse {
  app_usage: IAppUsageEntry[];
  meta: {
    has_next_results: boolean;
    has_previous_results: boolean;
  };
}

export interface IGetAppUsageResponse {
  app_usage: IAppUsageAggregate[];
  meta: {
    has_next_results: boolean;
    has_previous_results: boolean;
  };
}
