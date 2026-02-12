import React, { useContext, useMemo, useState } from "react";
import { InjectedRouter } from "react-router";
import { useQuery } from "react-query";

import { AppContext } from "context/app";
import { NotificationContext } from "context/notification";
import paths from "router/paths";
import enrollSecretsAPI from "services/entities/enroll_secret";
import { useTeamIdParam } from "hooks/useTeamIdParam";
import { DEFAULT_USE_QUERY_OPTIONS } from "utilities/constants";

import MainContent from "components/MainContent";
import BackButton from "components/BackButton";
import Spinner from "components/Spinner";
import Icon from "components/Icon";
import Button from "components/buttons/Button";
import Radio from "components/forms/fields/Radio";

import {
  PLATFORM_OPTIONS,
  getInstallCommand,
  IPlatformOption,
} from "../helpers";

const baseClass = "setup-guide-page";

interface ISetupGuidePageProps {
  router: InjectedRouter;
  params: {
    package_type: string;
  };
  location: {
    pathname: string;
    search: string;
    query: {
      team_id?: string;
    };
  };
}

interface IStepProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

const Step = ({ number, title, children }: IStepProps) => (
  <div className={`${baseClass}__step`}>
    <div className={`${baseClass}__step-number`}>{number}</div>
    <div className={`${baseClass}__step-content`}>
      <h3 className={`${baseClass}__step-title`}>{title}</h3>
      {children}
    </div>
  </div>
);

const SetupGuidePage = ({
  router,
  params,
  location,
}: ISetupGuidePageProps): JSX.Element => {
  const { package_type: packageType } = params;

  const {
    isGlobalAdmin,
    isGlobalMaintainer,
    config,
  } = useContext(AppContext);

  const { renderFlash } = useContext(NotificationContext);

  const {
    isAnyTeamSelected,
    isRouteOk,
    isTeamAdmin,
    isTeamMaintainer,
    teamIdForApi,
  } = useTeamIdParam({
    location,
    router,
    includeAllTeams: true,
    includeNoTeam: false,
  });

  const canEnrollHosts =
    isGlobalAdmin || isGlobalMaintainer || isTeamAdmin || isTeamMaintainer;
  const canEnrollGlobalHosts = isGlobalAdmin || isGlobalMaintainer;

  if (!canEnrollHosts) {
    router.push(paths.MANAGE_HOSTS);
  }

  const [hostType, setHostType] = useState<"workstation" | "server">(
    "workstation"
  );

  const platform: IPlatformOption | undefined = useMemo(
    () => PLATFORM_OPTIONS.find((p) => p.packageType === packageType),
    [packageType]
  );

  // Redirect if invalid package type
  if (!platform) {
    router.push(paths.ADD_DEVICE);
    return <></>;
  }

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

  const enrollSecret = isAnyTeamSelected
    ? teamSecrets?.[0]?.secret
    : globalSecrets?.[0]?.secret;

  const isLoading = isGlobalSecretsLoading || isTeamSecretsLoading;

  const command = enrollSecret
    ? getInstallCommand(packageType, hostType, config, enrollSecret)
    : "";

  const onCopyCommand = () => {
    navigator.clipboard.writeText(command).then(() => {
      renderFlash("success", "Install command copied to clipboard");
    });
  };

  const isWindows = packageType === "msi";

  const getTerminalName = () => {
    if (isWindows) return "PowerShell";
    return "Terminal";
  };

  const getOpenTerminalStep = () => {
    if (isWindows) {
      return (
        <p className={`${baseClass}__step-text`}>
          Open <strong>PowerShell as Administrator</strong>. Right-click the
          Start menu and select <strong>Windows Terminal (Admin)</strong> or
          search for &quot;PowerShell&quot;, right-click, and choose{" "}
          <strong>Run as administrator</strong>.
        </p>
      );
    }
    if (packageType === "pkg") {
      return (
        <p className={`${baseClass}__step-text`}>
          Open <strong>Terminal</strong>. You can find it in{" "}
          <strong>Applications &gt; Utilities &gt; Terminal</strong>, or press{" "}
          <strong>Cmd + Space</strong> and type &quot;Terminal&quot;.
        </p>
      );
    }
    // Linux
    return (
      <p className={`${baseClass}__step-text`}>
        Open a <strong>terminal</strong> on the device. You may need to use SSH
        if configuring a remote server. The command requires{" "}
        <strong>sudo</strong> privileges.
      </p>
    );
  };

  const getVerifyStep = () => {
    if (isWindows) {
      return (
        <p className={`${baseClass}__step-text`}>
          After the command finishes, the Fleet agent (osquery) will be running
          as a Windows service. The device should appear in your Fleet
          dashboard within a few minutes. You can verify the service is running
          with: <code>Get-Service osqueryd</code>
        </p>
      );
    }
    if (packageType === "pkg") {
      return (
        <p className={`${baseClass}__step-text`}>
          After the command finishes, the Fleet agent (osquery) will be running
          as a system service. The device should appear in your Fleet dashboard
          within a few minutes. You can verify with:{" "}
          <code>sudo launchctl list | grep fleet</code>
        </p>
      );
    }
    // Linux
    return (
      <p className={`${baseClass}__step-text`}>
        After the command finishes, the Fleet agent (osquery) will be running
        as a system service. The device should appear in your Fleet dashboard
        within a few minutes. You can verify with:{" "}
        <code>sudo systemctl status orbit.service</code>
      </p>
    );
  };

  if (isLoading) {
    return (
      <MainContent className={baseClass}>
        <Spinner />
      </MainContent>
    );
  }

  return (
    <MainContent className={baseClass}>
      <>
        <BackButton
          text="Back to Add device"
          path={paths.ADD_DEVICE}
        />
        <div className={`${baseClass}__header`}>
          <Icon name={platform.iconName as any} size="medium" />
          <div>
            <h1>
              {platform.name} setup guide
            </h1>
            <p className={`${baseClass}__subtitle`}>
              Follow these steps to enroll a {platform.name} device to Fleet.
            </p>
          </div>
        </div>

        {platform.supportsHostType && (
          <div className={`${baseClass}__host-type`}>
            <span className={`${baseClass}__host-type-label`}>
              Device type:
            </span>
            <Radio
              label="Workstation"
              id={`guide-workstation-${packageType}`}
              checked={hostType === "workstation"}
              value="workstation"
              name={`guide-host-type-${packageType}`}
              onChange={() => setHostType("workstation")}
            />
            <Radio
              label="Server"
              id={`guide-server-${packageType}`}
              checked={hostType === "server"}
              value="server"
              name={`guide-host-type-${packageType}`}
              onChange={() => setHostType("server")}
            />
          </div>
        )}

        <div className={`${baseClass}__steps`}>
          <Step number={1} title={`Open ${getTerminalName()}`}>
            {getOpenTerminalStep()}
          </Step>

          <Step number={2} title="Copy the install command">
            <p className={`${baseClass}__step-text`}>
              Click the button below to copy the command, then paste it into
              your {getTerminalName().toLowerCase()}.
            </p>
            <div className={`${baseClass}__command-block`}>
              <pre className={`${baseClass}__command-pre`}>{command}</pre>
              <Button
                className={`${baseClass}__copy-btn`}
                onClick={onCopyCommand}
                variant="default"
              >
                Copy command
              </Button>
            </div>
          </Step>

          <Step number={3} title="Run the command">
            <p className={`${baseClass}__step-text`}>
              Paste the command into {getTerminalName()} and press{" "}
              <strong>Enter</strong>. The command will download the Fleet agent,
              create an installer package, install it, and clean up temporary
              files. This may take a minute or two.
            </p>
            {!isWindows && (
              <p className={`${baseClass}__step-text`}>
                You will be prompted for your password when the{" "}
                <code>sudo</code> command runs.
              </p>
            )}
          </Step>

          <Step number={4} title="Verify enrollment">
            {getVerifyStep()}
          </Step>
        </div>

        <div className={`${baseClass}__footer`}>
          <Button
            variant="inverse"
            onClick={() => router.push(paths.ADD_DEVICE)}
          >
            Back to Add device
          </Button>
          <Button
            variant="default"
            onClick={() => router.push(paths.MANAGE_HOSTS)}
          >
            Go to Hosts
          </Button>
        </div>
      </>
    </MainContent>
  );
};

export default SetupGuidePage;
