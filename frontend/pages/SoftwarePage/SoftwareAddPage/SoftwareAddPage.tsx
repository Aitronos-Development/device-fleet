import React, { useCallback, useContext, useMemo } from "react";
import { Tab, TabList, Tabs } from "react-tabs";
import { InjectedRouter } from "react-router";
import { Location } from "history";

import PATHS from "router/paths";
import { getPathWithQueryParams } from "utilities/url";
import { QueryContext } from "context/query";
import useToggleSidePanel from "hooks/useToggleSidePanel";
import {
  APP_CONTEXT_ALL_TEAMS_ID,
  APP_CONTEXT_NO_TEAM_ID,
} from "interfaces/team";

import SidePanelPage from "components/SidePanelPage";
import MainContent from "components/MainContent";
import BackButton from "components/BackButton";
import TabNav from "components/TabNav";
import TabText from "components/TabText";
import SidePanelContent from "components/SidePanelContent";
import QuerySidePanel from "components/side_panels/QuerySidePanel";

const baseClass = "software-add-page";

interface IAddSoftwareSubNavItem {
  name: string;
  pathname: string;
}

const addSoftwareSubNav: IAddSoftwareSubNavItem[] = [
  {
    name: "Fleet-maintained",
    pathname: PATHS.SOFTWARE_ADD_FLEET_MAINTAINED,
  },
  {
    name: "App store",
    pathname: PATHS.SOFTWARE_ADD_APP_STORE,
  },
  {
    name: "Custom package",
    pathname: PATHS.SOFTWARE_ADD_PACKAGE,
  },
];

const getTabIndex = (path: string): number => {
  return addSoftwareSubNav.findIndex((navItem) => {
    // tab stays highlighted for paths that start with same pathname
    return path.startsWith(navItem.pathname);
  });
};

export interface ISoftwareAddPageQueryParams {
  team_id?: string;
  team_ids?: string;
  query?: string;
  page?: string;
  order_key?: string;
  order_direction?: "asc" | "desc";
}

interface ISoftwareAddPageProps {
  children: JSX.Element;
  location: Location<ISoftwareAddPageQueryParams>;
  router: InjectedRouter;
}

const SoftwareAddPage = ({
  children,
  location,
  router,
}: ISoftwareAddPageProps) => {
  const { selectedOsqueryTable, setSelectedOsqueryTable } = useContext(
    QueryContext
  );
  const { isSidePanelOpen, setSidePanelOpen } = useToggleSidePanel(false);

  // Parse multi-team IDs from query param (e.g. "1,2,3")
  const teamIds = useMemo(() => {
    if (location.query.team_ids) {
      return location.query.team_ids
        .split(",")
        .map((id) => parseInt(id, 10))
        .filter((id) => !Number.isNaN(id));
    }
    if (location.query.team_id) {
      const parsed = parseInt(location.query.team_id, 10);
      return Number.isNaN(parsed) ? [] : [parsed];
    }
    return [];
  }, [location.query.team_ids, location.query.team_id]);

  const isMultiTeam = teamIds.length > 1;
  const currentTeamId = teamIds[0] ?? APP_CONTEXT_NO_TEAM_ID;

  const navigateToNav = useCallback(
    (i: number): void => {
      setSidePanelOpen(false);
      // Persist team params between tabs
      const teamParams: Record<string, string | undefined> = location.query
        .team_ids
        ? { team_ids: location.query.team_ids, team_id: location.query.team_id }
        : { team_id: location.query.team_id };
      const navPath = getPathWithQueryParams(
        addSoftwareSubNav[i].pathname,
        teamParams
      );
      router.replace(navPath);
    },
    [location.query.team_id, location.query.team_ids, router, setSidePanelOpen]
  );

  // Quick exit if no team_id or team_ids param. This page must have a team id
  // to function correctly. We redirect to the same page with the "No team"
  // context if it is not provided.
  if (!location.query.team_id && !location.query.team_ids) {
    router.replace(
      getPathWithQueryParams(location.pathname, {
        team_id: APP_CONTEXT_NO_TEAM_ID,
      })
    );
    return null;
  }

  const onOsqueryTableSelect = (tableName: string) => {
    setSelectedOsqueryTable(tableName);
  };

  // When multi-team, back button goes to "All teams" software view
  const backUrl = isMultiTeam
    ? getPathWithQueryParams(PATHS.SOFTWARE_TITLES, {
        team_id: APP_CONTEXT_ALL_TEAMS_ID,
      })
    : getPathWithQueryParams(PATHS.SOFTWARE_TITLES, {
        team_id: location.query.team_id,
      });

  return (
    <SidePanelPage>
      <>
        <MainContent className={baseClass}>
          <div className={`${baseClass}__header-links`}>
            <BackButton
              text="Back to software"
              path={backUrl}
              className={`${baseClass}__back-to-software`}
            />
          </div>
          <h1>
            Add software
            {isMultiTeam && (
              <span className={`${baseClass}__multi-team-badge`}>
                {" "}
                ({teamIds.length} teams)
              </span>
            )}
          </h1>
          <TabNav>
            <Tabs
              selectedIndex={getTabIndex(location?.pathname || "")}
              onSelect={navigateToNav}
            >
              <TabList>
                {addSoftwareSubNav.map((navItem) => {
                  return (
                    <Tab key={navItem.name} data-text={navItem.name}>
                      <TabText>{navItem.name}</TabText>
                    </Tab>
                  );
                })}
              </TabList>
            </Tabs>
          </TabNav>
          {React.cloneElement(children, {
            router,
            currentTeamId,
            teamIds,
            isMultiTeam,
            isSidePanelOpen,
            setSidePanelOpen,
          })}
        </MainContent>
        {isSidePanelOpen && (
          <SidePanelContent>
            <QuerySidePanel
              key="query-side-panel"
              onOsqueryTableSelect={onOsqueryTableSelect}
              selectedOsqueryTable={selectedOsqueryTable}
              onClose={() => setSidePanelOpen(false)}
            />
          </SidePanelContent>
        )}
      </>
    </SidePanelPage>
  );
};

export default SoftwareAddPage;
