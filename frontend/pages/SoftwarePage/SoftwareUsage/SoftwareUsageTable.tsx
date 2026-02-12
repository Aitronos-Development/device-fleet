import React from "react";

import { IAppUsageAggregate } from "interfaces/app_usage";

const baseClass = "software-usage-table";

interface ISoftwareUsageTableProps {
  aggregates: IAppUsageAggregate[];
}

/** Format seconds into human-readable duration (e.g. "2h 15m" or "3d 5h") */
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

const SoftwareUsageTable = ({ aggregates }: ISoftwareUsageTableProps) => {
  return (
    <div className={baseClass}>
      <table className="data-table__table">
        <thead>
          <tr>
            <th>App</th>
            <th>Total hours (all hosts)</th>
            <th>Hosts using</th>
            <th>Avg hours/host</th>
          </tr>
        </thead>
        <tbody>
          {aggregates.map((app) => (
            <tr key={app.bundle_identifier}>
              <td className={`${baseClass}__app-name`}>
                <span className={`${baseClass}__name`}>
                  {app.app_name || app.bundle_identifier}
                </span>
                <span className={`${baseClass}__bundle-id`}>
                  {app.bundle_identifier}
                </span>
              </td>
              <td>{formatDuration(app.total_seconds)}</td>
              <td>{app.host_count}</td>
              <td>{formatDuration(Math.round(app.avg_seconds_per_host))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SoftwareUsageTable;
