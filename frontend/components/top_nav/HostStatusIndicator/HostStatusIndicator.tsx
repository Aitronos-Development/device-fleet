import React from "react";
import { Link } from "react-router";
import { useQuery } from "react-query";

import paths from "router/paths";
import hostSummaryAPI from "services/entities/host_summary";

const baseClass = "host-status-indicator";

const HostStatusIndicator = (): JSX.Element | null => {
  const { data: summaryData } = useQuery(
    ["host_summary_nav"],
    () => hostSummaryAPI.getSummary({}),
    {
      refetchInterval: 60000,
      refetchOnWindowFocus: false,
      select: (data: any) => ({
        onlineCount: data?.online_count ?? 0,
        totalCount: data?.totals_hosts_count ?? 0,
      }),
    }
  );

  const onlineCount = summaryData?.onlineCount ?? 0;
  const totalCount = summaryData?.totalCount ?? 0;

  return (
    <Link to={paths.MANAGE_HOSTS} className={baseClass}>
      <span
        className={`${baseClass}__dot ${
          onlineCount > 0 ? `${baseClass}__dot--online` : ""
        }`}
      />
      <span className={`${baseClass}__text`}>
        {totalCount > 0 ? `${onlineCount} online` : "No hosts"}
      </span>
    </Link>
  );
};

export default HostStatusIndicator;
