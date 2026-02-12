import { IConfig } from "interfaces/config";

export type PlatformType = "macOS" | "Windows" | "Linux" | "unknown";

export interface IPlatformOption {
  name: string;
  packageType: string;
  iconName: string;
  description: string;
  supportsHostType: boolean;
}

export const PLATFORM_OPTIONS: IPlatformOption[] = [
  {
    name: "macOS",
    packageType: "pkg",
    iconName: "darwin",
    description: ".pkg",
    supportsHostType: false,
  },
  {
    name: "Windows",
    packageType: "msi",
    iconName: "windows",
    description: ".msi",
    supportsHostType: true,
  },
  {
    name: "Linux (deb)",
    packageType: "deb",
    iconName: "linux",
    description: ".deb (Ubuntu, Debian)",
    supportsHostType: true,
  },
  {
    name: "Linux (rpm)",
    packageType: "rpm",
    iconName: "linux",
    description: ".rpm (CentOS, RHEL, Fedora)",
    supportsHostType: true,
  },
];

export const detectPlatform = (): PlatformType => {
  const { userAgent, platform } = navigator;

  if (platform?.startsWith("Mac") || /macintosh|macintel/i.test(userAgent)) {
    return "macOS";
  }
  if (platform?.startsWith("Win") || /windows/i.test(userAgent)) {
    return "Windows";
  }
  if (/linux/i.test(platform) || /linux/i.test(userAgent)) {
    return "Linux";
  }
  return "unknown";
};

const isDevUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
};

const getFleetctlFlags = (
  packageType: string,
  hostType: "workstation" | "server",
  config: IConfig | null,
  enrollSecret: string
): string => {
  const fleetUrl = config?.server_settings.server_url || "";
  const scriptsEnabled = config && !config.server_settings.scripts_disabled;
  const isDev = isDevUrl(fleetUrl);

  let flags = `--type=${packageType}`;
  if (scriptsEnabled) flags += " --enable-scripts";
  if (hostType === "workstation") flags += " --fleet-desktop";
  flags += ` --fleet-url=${fleetUrl}`;
  flags += ` --enroll-secret=${enrollSecret}`;
  if (isDev) {
    flags += " --insecure";
    flags += " --disable-updates";
  }
  return flags;
};

/**
 * Generate a complete one-liner install command for each platform.
 * Downloads fleetctl, generates the installer, installs it, and cleans up.
 * No prerequisites needed except curl/bash (macOS/Linux) or PowerShell (Windows).
 */
export const getInstallCommand = (
  packageType: string,
  hostType: "workstation" | "server",
  config: IConfig | null,
  enrollSecret: string
): string => {
  const flags = getFleetctlFlags(packageType, hostType, config, enrollSecret);

  if (packageType === "pkg") {
    // macOS: download fleetctl, generate .pkg, install with `installer`, clean up
    return [
      `TMPD=$(mktemp -d)`,
      `VER=$(curl -s https://api.github.com/repos/fleetdm/fleet/releases/latest | sed -n 's/.*"tag_name": *"\\([^"]*\\)".*/\\1/p')`,
      `curl -sL "https://github.com/fleetdm/fleet/releases/download/$VER/fleetctl_\${VER}_macos.tar.gz" | tar xz -C "$TMPD"`,
      `"$TMPD/fleetctl" package ${flags}`,
      `sudo installer -pkg fleet-osquery.pkg -target /`,
      `rm -rf "$TMPD" fleet-osquery.pkg`,
    ].join(" && ");
  }

  if (packageType === "msi") {
    // Windows PowerShell: download fleetctl, generate .msi, install with msiexec
    return [
      `$VER = (Invoke-RestMethod https://api.github.com/repos/fleetdm/fleet/releases/latest).tag_name`,
      `Invoke-WebRequest "https://github.com/fleetdm/fleet/releases/download/$VER/fleetctl_$($VER)_windows.zip" -OutFile "$env:TEMP\\fleetctl.zip"`,
      `Expand-Archive "$env:TEMP\\fleetctl.zip" -DestinationPath "$env:TEMP\\fleetctl" -Force`,
      `& "$env:TEMP\\fleetctl\\fleetctl.exe" package ${flags}`,
      `Start-Process msiexec.exe -ArgumentList "/i fleet-osquery.msi /quiet" -Wait -NoNewWindow`,
      `Remove-Item "$env:TEMP\\fleetctl*" -Recurse -Force; Remove-Item fleet-osquery.msi -Force`,
    ].join("; ");
  }

  if (packageType === "deb") {
    // Linux deb: download fleetctl, generate .deb, install with dpkg
    return [
      `TMPD=$(mktemp -d)`,
      `VER=$(curl -s https://api.github.com/repos/fleetdm/fleet/releases/latest | sed -n 's/.*"tag_name": *"\\([^"]*\\)".*/\\1/p')`,
      `curl -sL "https://github.com/fleetdm/fleet/releases/download/$VER/fleetctl_\${VER}_linux.tar.gz" | tar xz -C "$TMPD"`,
      `"$TMPD/fleetctl" package ${flags}`,
      `sudo dpkg -i fleet-osquery*.deb`,
      `rm -rf "$TMPD" fleet-osquery*.deb`,
    ].join(" && ");
  }

  if (packageType === "rpm") {
    // Linux rpm: download fleetctl, generate .rpm, install with rpm
    return [
      `TMPD=$(mktemp -d)`,
      `VER=$(curl -s https://api.github.com/repos/fleetdm/fleet/releases/latest | sed -n 's/.*"tag_name": *"\\([^"]*\\)".*/\\1/p')`,
      `curl -sL "https://github.com/fleetdm/fleet/releases/download/$VER/fleetctl_\${VER}_linux.tar.gz" | tar xz -C "$TMPD"`,
      `"$TMPD/fleetctl" package ${flags}`,
      `sudo rpm -i fleet-osquery*.rpm`,
      `rm -rf "$TMPD" fleet-osquery*.rpm`,
    ].join(" && ");
  }

  // Fallback
  return `fleetctl package ${flags}`;
};

export const getRecommendedPackageType = (
  detectedPlatform: PlatformType
): string => {
  switch (detectedPlatform) {
    case "macOS":
      return "pkg";
    case "Windows":
      return "msi";
    case "Linux":
      return "deb";
    default:
      return "";
  }
};
