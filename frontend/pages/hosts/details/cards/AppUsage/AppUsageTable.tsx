import React, { useMemo } from "react";

import { IAppUsageEntry } from "interfaces/app_usage";

const baseClass = "app-usage-table";

interface IAppUsageTableProps {
  entries: IAppUsageEntry[];
}

/** Format seconds into human-readable duration (e.g. "2h 15m") */
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
};

interface IAggregatedApp {
  bundle_identifier: string;
  app_name: string;
  today_seconds: number;
  week_seconds: number;
  month_seconds: number;
  total_seconds: number;
}

const AppUsageTable = ({ entries }: IAppUsageTableProps) => {
  const aggregated = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = monthAgo.toISOString().split("T")[0];

    const appMap = new Map<string, IAggregatedApp>();

    entries.forEach((entry) => {
      const existing = appMap.get(entry.bundle_identifier) ?? {
        bundle_identifier: entry.bundle_identifier,
        app_name: entry.app_name || entry.bundle_identifier,
        today_seconds: 0,
        week_seconds: 0,
        month_seconds: 0,
        total_seconds: 0,
      };

      existing.total_seconds += entry.active_seconds;

      if (entry.usage_date === todayStr) {
        existing.today_seconds += entry.active_seconds;
      }
      if (entry.usage_date >= weekAgoStr) {
        existing.week_seconds += entry.active_seconds;
      }
      if (entry.usage_date >= monthAgoStr) {
        existing.month_seconds += entry.active_seconds;
      }

      appMap.set(entry.bundle_identifier, existing);
    });

    return Array.from(appMap.values()).sort(
      (a, b) => b.total_seconds - a.total_seconds
    );
  }, [entries]);

  return (
    <div className={baseClass}>
      <table className="data-table__table">
        <thead>
          <tr>
            <th>App</th>
            <th>Today</th>
            <th>Last 7 days</th>
            <th>Last 30 days</th>
          </tr>
        </thead>
        <tbody>
          {aggregated.map((app) => (
            <tr key={app.bundle_identifier}>
              <td className={`${baseClass}__app-name`}>
                <span className={`${baseClass}__name`}>{app.app_name}</span>
                <span className={`${baseClass}__bundle-id`}>
                  {app.bundle_identifier}
                </span>
              </td>
              <td>{app.today_seconds > 0 ? formatDuration(app.today_seconds) : "-"}</td>
              <td>{app.week_seconds > 0 ? formatDuration(app.week_seconds) : "-"}</td>
              <td>{app.month_seconds > 0 ? formatDuration(app.month_seconds) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AppUsageTable;
