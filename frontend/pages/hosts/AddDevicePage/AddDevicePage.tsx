import React, { useContext, useMemo } from "react";
import { InjectedRouter } from "react-router";
import { useQuery } from "react-query";

import { AppContext } from "context/app";
import paths from "router/paths";
import enrollSecretsAPI from "services/entities/enroll_secret";
import configAPI from "services/entities/config";
import { useTeamIdParam } from "hooks/useTeamIdParam";
import { DEFAULT_USE_QUERY_OPTIONS } from "utilities/constants";

import MainContent from "components/MainContent";
import TeamsDropdown from "components/TeamsDropdown";
import Spinner from "components/Spinner";
import DataError from "components/DataError";
import Button from "components/buttons/Button";

import PlatformCard from "./PlatformCard/PlatformCard";
import AdvancedSection from "./AdvancedSection/AdvancedSection";
import {
  PLATFORM_OPTIONS,
  detectPlatform,
  getRecommendedPackageType,
} from "./helpers";

const baseClass = "add-device-page";

interface IAddDevicePageProps {
  router: InjectedRouter;
  location: {
    pathname: string;
    search: string;
    hash?: string;
    query: {
      team_id?: string;
    };
  };
}

const AddDevicePage = ({
  router,
  location,
}: IAddDevicePageProps): JSX.Element => {
  const {
    isGlobalAdmin,
    isGlobalMaintainer,
    isPreviewMode,
    isPremiumTier,
    isOnGlobalTeam,
    config,
  } = useContext(AppContext);

  const {
    currentTeamId,
    currentTeamName,
    isAnyTeamSelected,
    isRouteOk,
    isTeamAdmin,
    isTeamMaintainer,
    teamIdForApi,
    userTeams,
    handleTeamChange,
  } = useTeamIdParam({
    location,
    router,
    includeAllTeams: true,
    includeNoTeam: false,
  });

  const canEnrollHosts =
    isGlobalAdmin || isGlobalMaintainer || isTeamAdmin || isTeamMaintainer;
  const canEnrollGlobalHosts = isGlobalAdmin || isGlobalMaintainer;

  // Redirect if user can't enroll hosts
  if (!canEnrollHosts) {
    router.push(paths.MANAGE_HOSTS);
  }

  const detectedPlatform = useMemo(() => detectPlatform(), []);
  const recommendedPackageType = useMemo(
    () => getRecommendedPackageType(detectedPlatform),
    [detectedPlatform]
  );

  // Fetch global enroll secrets
  const {
    data: globalSecrets,
    isLoading: isGlobalSecretsLoading,
  } = useQuery(
    ["global secrets"],
    () => enrollSecretsAPI.getGlobalEnrollSecrets(),
    {
      ...DEFAULT_USE_QUERY_OPTIONS,
      enabled: isRouteOk && canEnrollGlobalHosts,
      select: (data: any) => data.secrets,
    }
  );

  // Fetch team enroll secrets
  const {
    data: teamSecrets,
    isLoading: isTeamSecretsLoading,
  } = useQuery(
    ["team secrets", teamIdForApi],
    () => enrollSecretsAPI.getTeamEnrollSecrets(teamIdForApi),
    {
      ...DEFAULT_USE_QUERY_OPTIONS,
      enabled: isRouteOk && isAnyTeamSelected && canEnrollHosts,
      select: (data) => data?.secrets,
    }
  );

  // Fetch certificate for advanced section
  const {
    data: certificate,
    error: fetchCertificateError,
    isFetching: isFetchingCertificate,
  } = useQuery<string, Error>(
    ["certificate"],
    () => configAPI.loadCertificate(),
    {
      enabled: !isPreviewMode,
      refetchOnWindowFocus: false,
    }
  );

  const enrollSecret = isAnyTeamSelected
    ? teamSecrets?.[0]?.secret
    : globalSecrets?.[0]?.secret;

  const isLoading = isGlobalSecretsLoading || isTeamSecretsLoading;

  const renderTeamSelector = () => {
    if (!isPremiumTier || !userTeams || userTeams.length <= 1) {
      return null;
    }
    return (
      <TeamsDropdown
        selectedTeamId={currentTeamId}
        currentUserTeams={userTeams}
        onChange={handleTeamChange}
      />
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return <Spinner />;
    }

    if (!enrollSecret) {
      return (
        <DataError>
          <span className="info__data">
            You have no enroll secrets. Manage enroll secrets to enroll hosts to{" "}
            <b>
              {(isAnyTeamSelected && currentTeamName) || "Fleet"}
            </b>
            .
          </span>
        </DataError>
      );
    }

    return (
      <>
        <div className={`${baseClass}__cards`}>
          {PLATFORM_OPTIONS.map((platform) => (
            <PlatformCard
              key={platform.packageType}
              platform={platform}
              enrollSecret={enrollSecret}
              config={config}
              isRecommended={platform.packageType === recommendedPackageType}
            />
          ))}
        </div>
        <AdvancedSection
          enrollSecret={enrollSecret}
          certificate={certificate}
          isFetchingCertificate={isFetchingCertificate}
          fetchCertificateError={fetchCertificateError}
          config={config}
        />
      </>
    );
  };

  return (
    <MainContent className={baseClass}>
      <>
        <div className={`${baseClass}__header`}>
          <div className={`${baseClass}__header-left`}>
            <h1>Add device</h1>
            <p className={`${baseClass}__subtitle`}>
              Copy and run a single command to download, install, and enroll a device. No prerequisites needed.
            </p>
          </div>
          <div className={`${baseClass}__header-right`}>
            {renderTeamSelector()}
          </div>
        </div>
        {renderContent()}
      </>
    </MainContent>
  );
};

export default AddDevicePage;
