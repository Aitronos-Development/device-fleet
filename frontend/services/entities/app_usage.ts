import sendRequest from "services";
import endpoints from "utilities/endpoints";
import { buildQueryStringFromParams } from "utilities/url";
import {
  IGetHostAppUsageResponse,
  IGetAppUsageResponse,
} from "interfaces/app_usage";

export interface IAppUsageQueryParams {
  page?: number;
  per_page?: number;
  order_key?: string;
  order_direction?: "asc" | "desc";
  start_date?: string;
  end_date?: string;
}

export interface IHostAppUsageQueryKey extends IAppUsageQueryParams {
  scope: "host-app-usage";
  id: number;
}

export interface IAppUsageAggregateQueryKey extends IAppUsageQueryParams {
  scope: "app-usage-aggregate";
  team_id?: number;
}

export default {
  getHostAppUsage: (
    params: IHostAppUsageQueryKey
  ): Promise<IGetHostAppUsageResponse> => {
    const { HOST_APP_USAGE } = endpoints;
    const { id, scope, ...rest } = params;
    const queryString = buildQueryStringFromParams(rest);
    return sendRequest("GET", `${HOST_APP_USAGE(id)}?${queryString}`);
  },

  getAppUsage: (
    params: IAppUsageAggregateQueryKey
  ): Promise<IGetAppUsageResponse> => {
    const { APP_USAGE } = endpoints;
    const { scope, ...rest } = params;
    const queryString = buildQueryStringFromParams(rest);
    return sendRequest("GET", `${APP_USAGE}?${queryString}`);
  },
};
