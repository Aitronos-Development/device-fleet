import React from "react";
import { useQuery } from "react-query";

import appUsageAPI, {
  IAppUsageAggregateQueryKey,
} from "services/entities/app_usage";
import { IAppUsageAggregate } from "interfaces/app_usage";

import Spinner from "components/Spinner";
import DataError from "components/DataError";
import EmptyTable from "components/EmptyTable";

import SoftwareUsageTable from "./SoftwareUsageTable";

const baseClass = "software-usage";

interface ISoftwareUsageProps {
  teamId?: number;
}

const SoftwareUsage = ({ teamId }: ISoftwareUsageProps) => {
  const queryKey: IAppUsageAggregateQueryKey = {
    scope: "app-usage-aggregate",
    team_id: teamId,
    per_page: 100,
    order_key: "total_seconds",
    order_direction: "desc",
  };

  const {
    data: appUsageData,
    isLoading,
    isError,
  } = useQuery<{ app_usage: IAppUsageAggregate[] }, Error>(
    [queryKey],
    () => appUsageAPI.getAppUsage(queryKey),
    {
      refetchOnWindowFocus: false,
      staleTime: 30000,
    }
  );

  if (isLoading) {
    return <Spinner />;
  }

  if (isError) {
    return <DataError />;
  }

  const aggregates = appUsageData?.app_usage ?? [];

  if (aggregates.length === 0) {
    return (
      <EmptyTable
        header="No app usage data"
        info="App usage data will appear here once macOS hosts report it."
      />
    );
  }

  return (
    <div className={baseClass}>
      <SoftwareUsageTable aggregates={aggregates} />
    </div>
  );
};

export default SoftwareUsage;
