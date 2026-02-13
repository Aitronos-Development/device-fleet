import React, { useContext, useState } from "react";
import { InjectedRouter } from "react-router";
import { useQuery } from "react-query";
import { AxiosError } from "axios";
import PATHS from "router/paths";

import { NotificationContext } from "context/notification";
import { AppContext } from "context/app";
import { ILabelSummary } from "interfaces/label";
import mdmAppleAPI, {
  IGetVppTokensResponse,
} from "services/entities/mdm_apple";
import softwareAPI from "services/entities/software";
import labelsAPI, { getCustomLabels } from "services/entities/labels";
import {
  DEFAULT_USE_QUERY_OPTIONS,
  LEARN_MORE_ABOUT_BASE_LINK,
} from "utilities/constants";

import EmptyTable from "components/EmptyTable";
import CustomLink from "components/CustomLink";
import DataError from "components/DataError";
import Spinner from "components/Spinner";
import PremiumFeatureMessage from "components/PremiumFeatureMessage";
import Button from "components/buttons/Button";
import CategoriesEndUserExperienceModal from "pages/SoftwarePage/components/modals/CategoriesEndUserExperienceModal";

import { APP_CONTEXT_ALL_TEAMS_ID } from "interfaces/team";
import { getPathWithQueryParams } from "utilities/url";
import MultiTeamDeployProgressModal from "pages/SoftwarePage/components/modals/MultiTeamDeployProgressModal";
import {
  deployToMultipleTeams,
  IMultiTeamDeployResult,
} from "../../multiTeamDeploy";
import SoftwareVppForm from "../../../components/forms/SoftwareVppForm";
import { getErrorMessage, teamHasVPPToken } from "./helpers";
import { ISoftwareVppFormData } from "../../../components/forms/SoftwareVppForm/SoftwareVppForm";

const baseClass = "software-app-store-vpp";
//

interface IEnableVppMessage {
  onEnableVpp: () => void;
}

const EnableVppMessage = ({ onEnableVpp }: IEnableVppMessage) => (
  <div className={`${baseClass}__enable-vpp-message`}>
    <p className={`${baseClass}__enable-vpp-title`}>
      Volume Purchasing Program (VPP) isn&apos;t enabled
    </p>
    <p className={`${baseClass}__enable-vpp-description`}>
      To add App Store apps, first enable VPP.
    </p>
    <Button onClick={onEnableVpp}>Enable VPP</Button>
  </div>
);

interface IAddTeamToVppMessage {
  onEditVpp: () => void;
}

const AddTeamToVppMessage = ({ onEditVpp }: IAddTeamToVppMessage) => (
  <EmptyTable
    header="This team isn't added to Volume Purchasing Program (VPP)"
    info="To add App Store apps, first add this team to VPP."
    primaryButton={<Button onClick={onEditVpp}> Edit VPP</Button>}
  />
);

const NoVppAppsMessage = () => (
  <div className={`${baseClass}__no-vpp-message`}>
    <p className={`${baseClass}__no-vpp-title`}>
      You don&apos;t have any App Store apps
    </p>
    <p className={`${baseClass}__no-vpp-description`}>
      You must purchase apps in{" "}
      <CustomLink
        url={`${LEARN_MORE_ABOUT_BASE_LINK}/abm-apps`}
        text="ABM"
        newTab
      />
      .<br />
      App Store apps that are already added to this team are not listed.
    </p>
  </div>
);

interface ISoftwareAppStoreProps {
  currentTeamId: number;
  teamIds?: number[];
  isMultiTeam?: boolean;
  router: InjectedRouter;
}

const SoftwareAppStoreVpp = ({
  currentTeamId,
  teamIds = [],
  isMultiTeam = false,
  router,
}: ISoftwareAppStoreProps) => {
  const { renderFlash } = useContext(NotificationContext);
  const { isPremiumTier, availableTeams } = useContext(AppContext);

  const [isLoading, setIsLoading] = useState(false);
  const [showPreviewEndUserExperience, setShowPreviewEndUserExperience] =
    useState(false);
  const [isIosOrIpadosApp, setIsIosOrIpadosApp] = useState(false);
  const [deployResults, setDeployResults] = useState<IMultiTeamDeployResult[]>(
    []
  );
  const [isDeployComplete, setIsDeployComplete] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const {
    data: vppInfo,
    isLoading: isLoadingVppInfo,
    error: errorVppInfo,
  } = useQuery<IGetVppTokensResponse, AxiosError>(
    ["vppInfo", currentTeamId],
    () => mdmAppleAPI.getVppTokens(),
    {
      ...DEFAULT_USE_QUERY_OPTIONS,
      staleTime: 30000,
      retry: (tries, error) => error.status !== 404 && tries <= 3,
    },
  );

  const {
    data: labels,
    isLoading: isLoadingLabels,
    isError: isErrorLabels,
  } = useQuery<ILabelSummary[], Error>(
    ["custom_labels"],
    () =>
      labelsAPI
        .summary(currentTeamId)
        .then((res) => getCustomLabels(res.labels)),

    {
      ...DEFAULT_USE_QUERY_OPTIONS,
      enabled: isPremiumTier,
      staleTime: 10000,
    },
  );

  const noVppTokenUploaded = !vppInfo || !vppInfo.vpp_tokens.length;
  const hasVppToken = teamHasVPPToken(currentTeamId, vppInfo?.vpp_tokens);

  const {
    data: vppApps,
    isLoading: isLoadingVppApps,
    error: errorVppApps,
  } = useQuery(
    ["vppSoftware", currentTeamId],
    () => mdmAppleAPI.getVppApps(currentTeamId),
    {
      ...DEFAULT_USE_QUERY_OPTIONS,
      enabled: hasVppToken,
      staleTime: 30000,
      select: (res) => res.app_store_apps,
    },
  );

  const goBackToSoftwareTitles = (showAvailableForInstallOnly = false) => {
    const queryParams = {
      team_id: currentTeamId,
      ...(showAvailableForInstallOnly && { available_for_install: true }),
    };

    router.push(getPathWithQueryParams(PATHS.SOFTWARE_TITLES, queryParams));
  };

  const onClickPreviewEndUserExperience = (iosOrIpadosApp?: boolean) => {
    setShowPreviewEndUserExperience(!showPreviewEndUserExperience);
    setIsIosOrIpadosApp(iosOrIpadosApp || false);
  };

  const onMultiTeamDone = () => {
    setShowProgressModal(false);
    router.push(
      getPathWithQueryParams(PATHS.SOFTWARE_TITLES, {
        team_id: APP_CONTEXT_ALL_TEAMS_ID,
      })
    );
    const successCount = deployResults.filter((r) => r.status === "success")
      .length;
    const errorCount = deployResults.filter((r) => r.status === "error").length;
    if (errorCount > 0) {
      renderFlash(
        "error",
        `Software added to ${successCount} of ${deployResults.length} teams. ${errorCount} failed.`
      );
    } else {
      renderFlash("success", `Software added to ${successCount} teams.`);
    }
  };

  const onAddSoftware = async (formData: ISoftwareVppFormData) => {
    if (!formData.selectedApp) {
      return;
    }

    // Multi-team deploy
    if (isMultiTeam && teamIds.length > 1) {
      setShowProgressModal(true);
      setIsDeployComplete(false);
      const teamNameMap = teamIds.reduce<Record<number, string>>((acc, id) => {
        const team = availableTeams?.find((t) => t.id === id);
        acc[id] = team?.name || `Team ${id}`;
        return acc;
      }, {});

      const results = await deployToMultipleTeams(
        teamIds,
        teamNameMap,
        async (tid) => {
          await softwareAPI.addAppStoreApp(tid, formData);
        },
        setDeployResults
      );
      setDeployResults(results);
      setIsDeployComplete(true);
      return;
    }

    // Single-team deploy (existing logic)
    setIsLoading(true);

    try {
      const { software_title_id: softwareVppTitleId } =
        await softwareAPI.addAppStoreApp(currentTeamId, formData);

      renderFlash(
        "success",
        <>
          <b>{formData.selectedApp.name}</b> successfully added.
        </>,
        { persistOnPageChange: true },
      );

      router.push(
        getPathWithQueryParams(
          PATHS.SOFTWARE_TITLE_DETAILS(softwareVppTitleId.toString()),
          { team_id: currentTeamId },
        ),
      );
    } catch (e) {
      renderFlash("error", getErrorMessage(e));
    }

    setIsLoading(false);
  };

  const renderContent = () => {
    if (!isPremiumTier) {
      return (
        <PremiumFeatureMessage className={`${baseClass}__premium-message`} />
      );
    }

    if (isLoadingVppInfo || isLoadingVppApps || isLoadingLabels) {
      return <Spinner />;
    }

    if (errorVppInfo || errorVppApps || isErrorLabels) {
      return <DataError verticalPaddingSize="pad-xxxlarge" />;
    }

    if (noVppTokenUploaded) {
      return (
        <EnableVppMessage
          onEnableVpp={() => router.push(PATHS.ADMIN_INTEGRATIONS_VPP)}
        />
      );
    }

    if (!hasVppToken) {
      return (
        <AddTeamToVppMessage
          onEditVpp={() => router.push(PATHS.ADMIN_INTEGRATIONS_VPP)}
        />
      );
    }

    if (!vppApps) {
      return <NoVppAppsMessage />;
    }
    return (
      <div className={`${baseClass}__content`}>
        <SoftwareVppForm
          labels={labels || []}
          onSubmit={onAddSoftware}
          onCancel={goBackToSoftwareTitles}
          onClickPreviewEndUserExperience={onClickPreviewEndUserExperience}
          isLoading={isLoading}
          vppApps={vppApps}
        />
        {showPreviewEndUserExperience && (
          <CategoriesEndUserExperienceModal
            onCancel={onClickPreviewEndUserExperience}
            isIosOrIpadosApp={isIosOrIpadosApp}
          />
        )}
      </div>
    );
  };

  return (
    <div className={baseClass}>
      {renderContent()}
      {showProgressModal && (
        <MultiTeamDeployProgressModal
          results={deployResults}
          onDone={onMultiTeamDone}
          isComplete={isDeployComplete}
        />
      )}
    </div>
  );
};

export default SoftwareAppStoreVpp;
