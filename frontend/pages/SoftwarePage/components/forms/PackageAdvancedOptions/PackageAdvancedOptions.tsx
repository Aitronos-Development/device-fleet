import React, { useState } from "react";
import { noop } from "lodash";

import { LEARN_MORE_ABOUT_BASE_LINK } from "utilities/constants";
import { getExtensionFromFileName } from "utilities/file/fileUtils";

import {
  isPackageType,
  isWindowsPackageType,
  isFleetMaintainedPackageType,
  PackageType,
} from "interfaces/package_type";

import CustomLink from "components/CustomLink";
import RevealButton from "components/buttons/RevealButton";

import { IPackageFormData } from "../PackageForm/PackageForm";
import AdvancedOptionsFields from "../AdvancedOptionsFields";

const getSupportedScriptTypeText = (pkgType: PackageType) => {
  return isWindowsPackageType(pkgType)
    ? "Supports PowerShell scripts."
    : "Supports shell scripts.";
};

const PKG_TYPE_TO_ID_TEXT = {
  pkg: "package IDs",
  deb: "package name",
  rpm: "package name",
  msi: "product code",
  exe: "software name",
  zip: "software name",
  sh: "package name",
  ps1: "package name",
  ipa: "software name",
} as const;

const getInstallScriptTooltip = (pkgType: PackageType) => {
  if (pkgType === "exe" || pkgType === "tar.gz") {
    return `You need to provide an install script for .${pkgType} files.`;
  }
  if (pkgType === "zip" && isWindowsPackageType(pkgType)) {
    return "You need to provide an install script for .zip files.";
  }
  return undefined;
};

const getInstallHelpText = (pkgType: PackageType) => {
  if (pkgType === "exe" || pkgType === "zip") {
    return (
      <>
        Fleet auto-generates install scripts for .msi files only. For .
        {pkgType} files, write your own script. Use $INSTALLER_PATH to
        reference the downloaded file. {getSupportedScriptTypeText(pkgType)}{" "}
        <CustomLink
          url={`${LEARN_MORE_ABOUT_BASE_LINK}/exe-install-scripts`}
          text="Learn more"
          newTab
        />
      </>
    );
  }

  return (
    <>
      Fleet fills this in automatically. Edit if you need a custom install
      process. Use $INSTALLER_PATH to reference the downloaded file.{" "}
      {getSupportedScriptTypeText(pkgType)}{" "}
      <CustomLink
        url={`${LEARN_MORE_ABOUT_BASE_LINK}/install-scripts`}
        text="Learn more"
        newTab
      />
    </>
  );
};

const getPostInstallHelpText = (pkgType: PackageType) => {
  return getSupportedScriptTypeText(pkgType);
};

const getUninstallScriptTooltip = (pkgType: PackageType) => {
  if (pkgType === "exe" || pkgType === "tar.gz") {
    return `You need to provide an uninstall script for .${pkgType} files.`;
  }
  if (pkgType === "zip" && isWindowsPackageType(pkgType)) {
    return "You need to provide an uninstall script for .zip files.";
  }
  return undefined;
};

const getUninstallHelpText = (pkgType: PackageType) => {
  // Check for Windows zip files first (before isFleetMaintainedPackageType check)
  if (pkgType === "zip" && isWindowsPackageType(pkgType)) {
    return (
      <>
        Fleet auto-generates uninstall scripts for .msi files only. For .zip
        files, write your own script. $PACKAGE_ID will be filled in with the
        software name automatically. {getSupportedScriptTypeText(pkgType)}{" "}
        <CustomLink
          url={`${LEARN_MORE_ABOUT_BASE_LINK}/exe-install-scripts`}
          text="Learn more"
          newTab
        />
      </>
    );
  }

  if (isFleetMaintainedPackageType(pkgType)) {
    return getSupportedScriptTypeText(pkgType);
  }

  if (pkgType === "exe") {
    return (
      <>
        Fleet auto-generates uninstall scripts for .msi files only. For .exe
        files, write your own script. $PACKAGE_ID will be filled in with the
        software name automatically. {getSupportedScriptTypeText(pkgType)}{" "}
        <CustomLink
          url={`${LEARN_MORE_ABOUT_BASE_LINK}/exe-install-scripts`}
          text="Learn more"
          newTab
        />
      </>
    );
  }

  if (pkgType === "tar.gz") {
    return (
      <>
        {getSupportedScriptTypeText(pkgType)}{" "}
        <CustomLink
          url={`${LEARN_MORE_ABOUT_BASE_LINK}/uninstall-scripts`}
          text="Learn more"
          newTab
        />
      </>
    );
  }

  if (pkgType === "msi") {
    return (
      <>
        Fleet fills this in automatically using the installer&apos;s product
        code. Edit if you need a custom uninstall process.{" "}
        {getSupportedScriptTypeText(pkgType)}{" "}
        <CustomLink
          url={`${LEARN_MORE_ABOUT_BASE_LINK}/uninstall-scripts`}
          text="Learn more"
          newTab
        />
      </>
    );
  }

  return (
    <>
      Fleet fills this in automatically. $PACKAGE_ID will be set to the{" "}
      {PKG_TYPE_TO_ID_TEXT[pkgType]} from the .{pkgType} file.{" "}
      {getSupportedScriptTypeText(pkgType)}{" "}
      <CustomLink
        url={`${LEARN_MORE_ABOUT_BASE_LINK}/uninstall-scripts`}
        text="Learn more"
        newTab
      />
    </>
  );
};

const baseClass = "package-advanced-options";

interface IPackageAdvancedOptionsProps {
  errors: { preInstallQuery?: string; postInstallScript?: string };
  selectedPackage: IPackageFormData["software"];
  preInstallQuery?: string;
  installScript: string;
  postInstallScript?: string;
  uninstallScript?: string;
  showSchemaButton?: boolean;
  onClickShowSchema?: () => void;
  onChangePreInstallQuery: (value?: string) => void;
  onChangeInstallScript: (value: string) => void;
  onChangePostInstallScript: (value?: string) => void;
  onChangeUninstallScript: (value?: string) => void;
  /** Currently for editing FMA only, users cannot edit */
  gitopsCompatible?: boolean;
  gitOpsModeEnabled?: boolean;
}

const PackageAdvancedOptions = ({
  showSchemaButton = false,
  errors,
  selectedPackage,
  preInstallQuery,
  installScript,
  postInstallScript,
  uninstallScript,
  onClickShowSchema = noop,
  onChangePreInstallQuery,
  onChangeInstallScript,
  onChangePostInstallScript,
  onChangeUninstallScript,
  gitopsCompatible = false,
  gitOpsModeEnabled = false,
}: IPackageAdvancedOptionsProps) => {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const name = selectedPackage?.name || "";
  const ext = getExtensionFromFileName(name);

  const renderAdvancedOptions = () => {
    if (!isPackageType(ext)) {
      // this should never happen
      return null;
    }

    return (
      <AdvancedOptionsFields
        className={`${baseClass}__input-fields`}
        showSchemaButton={showSchemaButton}
        installScriptTooltip={getInstallScriptTooltip(ext)}
        installScriptHelpText={getInstallHelpText(ext)}
        postInstallScriptHelpText={getPostInstallHelpText(ext)}
        uninstallScriptTooltip={getUninstallScriptTooltip(ext)}
        uninstallScriptHelpText={getUninstallHelpText(ext)}
        errors={errors}
        preInstallQuery={preInstallQuery}
        installScript={installScript}
        postInstallScript={postInstallScript}
        uninstallScript={uninstallScript}
        onClickShowSchema={onClickShowSchema}
        onChangePreInstallQuery={onChangePreInstallQuery}
        onChangeInstallScript={onChangeInstallScript}
        onChangePostInstallScript={onChangePostInstallScript}
        onChangeUninstallScript={onChangeUninstallScript}
        gitopsCompatible={gitopsCompatible}
        gitOpsModeEnabled={gitOpsModeEnabled}
      />
    );
  };

  const requiresAdvancedOptions =
    ext === "exe" || ext === "zip" || ext === "tar.gz";

  return (
    <div className={baseClass}>
      <RevealButton
        className={`${baseClass}__accordion-title`}
        isShowing={showAdvancedOptions}
        showText="Advanced options"
        hideText="Advanced options"
        caretPosition="after"
        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
        disabled={!selectedPackage || requiresAdvancedOptions}
        disabledTooltipContent={
          requiresAdvancedOptions ? (
            <>
              .{ext} files need install and uninstall scripts. These are shown
              below.
            </>
          ) : (
            <>
              Upload a file first to see <br />
              these options.
            </>
          )
        }
      />
      {(showAdvancedOptions ||
        ext === "exe" ||
        ext === "zip" ||
        ext === "tar.gz") &&
        !!selectedPackage &&
        renderAdvancedOptions()}
    </div>
  );
};

export default PackageAdvancedOptions;
