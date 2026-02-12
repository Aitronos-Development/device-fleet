import React, { useCallback } from "react";
import { useQuery } from "react-query";
import classnames from "classnames";

import appUsageAPI, {
  IHostAppUsageQueryKey,
} from "services/entities/app_usage";
import { IAppUsageEntry } from "interfaces/app_usage";

import Card from "components/Card";
import CardHeader from "components/CardHeader";
import DataError from "components/DataError";
import Spinner from "components/Spinner";
import EmptyTable from "components/EmptyTable";

import AppUsageTable from "./AppUsageTable";

const baseClass = "app-usage-card";

interface IAppUsageProps {
  hostId: number;
  className?: string;
}

const AppUsageCard = ({ hostId, className }: IAppUsageProps) => {
  const queryKey: IHostAppUsageQueryKey = {
    scope: "host-app-usage",
    id: hostId,
    per_page: 100,
    order_key: "active_seconds",
    order_direction: "desc",
  };

  const {
    data: appUsageData,
    isLoading,
    isError,
  } = useQuery<{ app_usage: IAppUsageEntry[] }, Error>(
    [queryKey],
    () => appUsageAPI.getHostAppUsage(queryKey),
    {
      refetchOnWindowFocus: false,
      staleTime: 30000,
    }
  );

  const renderContent = useCallback(() => {
    if (isLoading) {
      return <Spinner />;
    }

    if (isError) {
      return <DataError verticalPaddingSize="pad-large" />;
    }

    const entries = appUsageData?.app_usage ?? [];
    if (entries.length === 0) {
      return (
        <EmptyTable
          header="No app usage data"
          info="App usage data will appear here once the host reports it."
        />
      );
    }

    return <AppUsageTable entries={entries} />;
  }, [isLoading, isError, appUsageData]);

  const classNames = classnames(baseClass, className);

  return (
    <Card className={classNames} borderRadiusSize="xxlarge" paddingSize="xlarge">
      <CardHeader header="App usage" />
      {renderContent()}
    </Card>
  );
};

export default AppUsageCard;
