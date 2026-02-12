import React, { useContext, useEffect, useState } from "react";
import { InjectedRouter } from "react-router";
import { useQuery } from "react-query";

import PATHS from "router/paths";
import { APP_CONTEXT_ALL_TEAMS_ID } from "interfaces/team";
import { DEFAULT_USE_QUERY_OPTIONS } from "utilities/constants";
import { getFileDetails, IFileDetails } from "utilities/file/fileUtils";
import { getPathWithQueryParams, QueryParams } from "utilities/url";
import softwareAPI from "services/entities/software";
import labelsAPI, { getCustomLabels } from "services/entities/labels";

import { NotificationContext } from "context/notification";
import { AppContext } from "context/app";
import { ILabelSummary } from "interfaces/label";

import FileProgressModal from "components/FileProgressModal";
import PremiumFeatureMessage from "components/PremiumFeatureMessage";
import Spinner from "components/Spinner";
import DataError from "components/DataError";
import CategoriesEndUserExperienceModal from "pages/SoftwarePage/components/modals/CategoriesEndUserExperienceModal";

import PackageForm from "pages/SoftwarePage/components/forms/PackageForm";
import { IPackageFormData } from "pages/SoftwarePage/components/forms/PackageForm/PackageForm";

import MultiTeamDeployProgressModal from "pages/SoftwarePage/components/modals/MultiTeamDeployProgressModal";
import {
  deployToMultipleTeams,
  IMultiTeamDeployResult,
} from "../multiTeamDeploy";
import { getErrorMessage } from "./helpers";

const baseClass = "software-custom-package";

interface ISoftwarePackageProps {
  currentTeamId: number;
  teamIds?: number[];
  isMultiTeam?: boolean;
  router: InjectedRouter;
  isSidePanelOpen: boolean;
  setSidePanelOpen: (isOpen: boolean) => void;
}

const SoftwareCustomPackage = ({
  currentTeamId,
  teamIds = [],
  isMultiTeam = false,
  router,
  isSidePanelOpen,
  setSidePanelOpen,
}: ISoftwarePackageProps) => {
  const { renderFlash } = useContext(NotificationContext);
  const { isPremiumTier, config, availableTeams } = useContext(AppContext);
  const gitOpsModeEnabled = config?.gitops.gitops_mode_enabled;

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDetails, setUploadDetails] = useState<IFileDetails | null>(null);
  const [
    showPreviewEndUserExperience,
    setShowPreviewEndUserExperience,
  ] = useState(false);
  const [
    isIpadOrIphoneSoftwareSource,
    setIsIpadOrIphoneSoftwareSource,
  ] = useState(false);
  const [deployResults, setDeployResults] = useState<IMultiTeamDeployResult[]>(
    []
  );
  const [isDeployComplete, setIsDeployComplete] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

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
    }
  );

  useEffect(() => {
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Next line with e.returnValue is included for legacy support
      // e.g.Chrome / Edge < 119
      e.returnValue = true;
    };

    // set up event listener to prevent user from leaving page while uploading
    if (uploadDetails) {
      addEventListener("beforeunload", beforeUnloadHandler);
    } else {
      removeEventListener("beforeunload", beforeUnloadHandler);
    }

    // clean up event listener and timeout on component unmount
    return () => {
      removeEventListener("beforeunload", beforeUnloadHandler);
    };
  }, [uploadDetails]);

  const onClickPreviewEndUserExperience = (isIosOrIpadosApp = false) => {
    setShowPreviewEndUserExperience(!showPreviewEndUserExperience);
    setIsIpadOrIphoneSoftwareSource(isIosOrIpadosApp);
  };

  const onCancel = () => {
    router.push(
      getPathWithQueryParams(PATHS.SOFTWARE_TITLES, {
        team_id: currentTeamId,
      })
    );
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

  const onSubmit = async (formData: IPackageFormData) => {
    if (!formData.software) {
      renderFlash(
        "error",
        `Couldn't add. Please refresh the page and try again.`
      );
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
          await softwareAPI.addSoftwarePackage({
            data: formData,
            teamId: tid,
          });
        },
        setDeployResults
      );
      setDeployResults(results);
      setIsDeployComplete(true);
      return;
    }

    // Single-team deploy (existing logic)
    setUploadDetails(getFileDetails(formData.software, true));

    // Note: This TODO is copied to onSaveSoftwareChanges in EditSoftwareModal
    // TODO: confirm we are deleting the second sentence (not modifying it) for non-self-service installers
    try {
      const {
        software_package: { title_id: softwarePackageTitleId },
      } = await softwareAPI.addSoftwarePackage({
        data: formData,
        teamId: currentTeamId,
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.progress || 0;
          // for large uploads it seems to take a bit for the server to finalize its response so we'll keep the
          // progress bar at 97% until the server response is received
          setUploadProgress(Math.max(progress - 0.03, 0.01));
        },
      });

      if (!gitOpsModeEnabled) {
        renderFlash(
          "success",
          <>
            <b>{formData.software?.name}</b> successfully added.
            {formData.selfService
              ? " The end user can install from Fleet Desktop."
              : ""}
          </>
        );
      }

      const newQueryParams: QueryParams = {
        team_id: currentTeamId,
        gitops_yaml: gitOpsModeEnabled ? "true" : undefined,
      };
      router.push(
        getPathWithQueryParams(
          PATHS.SOFTWARE_TITLE_DETAILS(softwarePackageTitleId.toString()),
          newQueryParams
        )
      );
    } catch (e) {
      renderFlash("error", getErrorMessage(e));
    }
    setUploadDetails(null);
  };

  const renderContent = () => {
    if (isLoadingLabels) {
      return <Spinner />;
    }

    if (isErrorLabels) {
      return <DataError verticalPaddingSize="pad-xxxlarge" />;
    }

    return (
      <>
        <PackageForm
          labels={labels || []}
          showSchemaButton={!isSidePanelOpen}
          onClickShowSchema={() => setSidePanelOpen(true)}
          className={`${baseClass}__package-form`}
          onCancel={onCancel}
          onSubmit={onSubmit}
          onClickPreviewEndUserExperience={onClickPreviewEndUserExperience}
        />
        {uploadDetails && (
          <FileProgressModal
            fileDetails={uploadDetails}
            fileProgress={uploadProgress}
          />
        )}
        {showPreviewEndUserExperience && (
          <CategoriesEndUserExperienceModal
            onCancel={onClickPreviewEndUserExperience}
            isIosOrIpadosApp={isIpadOrIphoneSoftwareSource}
          />
        )}
        {showProgressModal && (
          <MultiTeamDeployProgressModal
            results={deployResults}
            onDone={onMultiTeamDone}
            isComplete={isDeployComplete}
          />
        )}
      </>
    );
  };

  if (!isPremiumTier) {
    return (
      <PremiumFeatureMessage className={`${baseClass}__premium-message`} />
    );
  }

  return <div className={baseClass}>{renderContent()}</div>;
};

export default SoftwareCustomPackage;
