import React, { useState, useContext } from "react";
import { Link } from "react-router";
import classnames from "classnames";

import { NotificationContext } from "context/notification";
import { IConfig } from "interfaces/config";
import paths from "router/paths";

import Icon from "components/Icon";
import Button from "components/buttons/Button";
import Radio from "components/forms/fields/Radio";
// @ts-ignore
import InputField from "components/forms/fields/InputField";

import { IPlatformOption, getInstallCommand } from "../helpers";

interface IPlatformCardProps {
  platform: IPlatformOption;
  enrollSecret: string;
  config: IConfig | null;
  isRecommended: boolean;
}

const baseClass = "platform-card";

const PlatformCard = ({
  platform,
  enrollSecret,
  config,
  isRecommended,
}: IPlatformCardProps): JSX.Element => {
  const { renderFlash } = useContext(NotificationContext);
  const [hostType, setHostType] = useState<"workstation" | "server">(
    "workstation"
  );

  const command = getInstallCommand(
    platform.packageType,
    hostType,
    config,
    enrollSecret
  );

  const onCopyCommand = () => {
    navigator.clipboard.writeText(command).then(() => {
      renderFlash("success", "Install command copied to clipboard");
    });
  };

  const cardClasses = classnames(baseClass, {
    [`${baseClass}--recommended`]: isRecommended,
  });

  const shellHint =
    platform.packageType === "msi"
      ? "Paste into PowerShell as Administrator"
      : "Paste into Terminal";

  return (
    <div className={cardClasses}>
      <div className={`${baseClass}__header`}>
        <div className={`${baseClass}__platform-info`}>
          <Icon name={platform.iconName as any} size="medium" />
          <div className={`${baseClass}__platform-text`}>
            <span className={`${baseClass}__platform-name`}>
              {platform.name}
            </span>
            <span className={`${baseClass}__platform-desc`}>
              {platform.description}
            </span>
          </div>
        </div>
        {isRecommended && (
          <span className={`${baseClass}__badge`}>Recommended</span>
        )}
      </div>
      {platform.supportsHostType && (
        <div className={`${baseClass}__host-type`}>
          <Radio
            className={`${baseClass}__radio`}
            label="Workstation"
            id={`workstation-${platform.packageType}`}
            checked={hostType === "workstation"}
            value="workstation"
            name={`host-type-${platform.packageType}`}
            onChange={() => setHostType("workstation")}
          />
          <Radio
            className={`${baseClass}__radio`}
            label="Server"
            id={`server-${platform.packageType}`}
            checked={hostType === "server"}
            value="server"
            name={`host-type-${platform.packageType}`}
            onChange={() => setHostType("server")}
          />
        </div>
      )}
      <InputField
        readOnly
        inputWrapperClass={`${baseClass}__command-input`}
        name={`installer-${platform.packageType}`}
        type="textarea"
        value={command}
        helpText={shellHint}
      />
      <div className={`${baseClass}__actions`}>
        <Button
          className={`${baseClass}__copy-btn`}
          onClick={onCopyCommand}
          variant="default"
        >
          <Icon name="copy" size="small" />
          Copy install command
        </Button>
        <Link
          to={paths.ADD_DEVICE_GUIDE(platform.packageType)}
          className={`${baseClass}__guide-link`}
        >
          Setup guide
        </Link>
      </div>
    </div>
  );
};

export default PlatformCard;
