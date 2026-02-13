import React, { useState, useContext } from "react";
import FileSaver from "file-saver";

import { NotificationContext } from "context/notification";
import { IConfig } from "interfaces/config";

import Button from "components/buttons/Button";
import Icon from "components/Icon";
import RevealButton from "components/buttons/RevealButton";
// @ts-ignore
import InputField from "components/forms/fields/InputField";
import CustomLink from "components/CustomLink";
import InfoBanner from "components/InfoBanner/InfoBanner";

import IosIpadosPanel from "components/AddHostsModal/PlatformWrapper/IosIpadosPanel";
import AndroidPanel from "components/AddHostsModal/PlatformWrapper/AndroidPanel";

import { isValidPemCertificate } from "../../ManageHostsPage/helpers";

interface IAdvancedSectionProps {
  enrollSecret: string;
  certificate: string | undefined;
  isFetchingCertificate: boolean;
  fetchCertificateError: any;
  config: IConfig | null;
}

const baseClass = "advanced-section";

const AdvancedSection = ({
  enrollSecret,
  certificate,
  isFetchingCertificate,
  fetchCertificateError,
  config,
}: IAdvancedSectionProps): JSX.Element => {
  const { renderFlash } = useContext(NotificationContext);
  const [isOpen, setIsOpen] = useState(false);
  const [showPlainOsquery, setShowPlainOsquery] = useState(false);

  let tlsHostname = config?.server_settings.server_url || "";
  try {
    const serverUrl = new URL(config?.server_settings.server_url || "");
    tlsHostname = serverUrl.hostname;
    if (serverUrl.port) {
      tlsHostname += `:${serverUrl.port}`;
    }
  } catch (e) {
    if (!(e instanceof TypeError)) {
      throw e;
    }
  }

  const advancedCommand = `fleetctl package --type=YOUR_TYPE --fleet-url=${config?.server_settings.server_url} --enroll-secret=${enrollSecret} --fleet-certificate=PATH_TO_YOUR_CERTIFICATE/fleet.pem`;

  const flagfileContent = `# Server
--tls_hostname=${tlsHostname}
--tls_server_certs=fleet.pem
# Enrollment
--host_identifier=instance
--enroll_secret_path=secret.txt
--enroll_tls_endpoint=/api/osquery/enroll
# Configuration
--config_plugin=tls
--config_tls_endpoint=/api/v1/osquery/config
--config_refresh=10
# Live query
--disable_distributed=false
--distributed_plugin=tls
--distributed_interval=10
--distributed_tls_max_attempts=3
--distributed_tls_read_endpoint=/api/v1/osquery/distributed/read
--distributed_tls_write_endpoint=/api/v1/osquery/distributed/write
# Logging
--logger_plugin=tls
--logger_tls_endpoint=/api/v1/osquery/log
--logger_tls_period=10
# File carving
--disable_carver=false
--carver_start_endpoint=/api/v1/osquery/carve/begin
--carver_continue_endpoint=/api/v1/osquery/carve/block
--carver_block_size=8000000`;

  const onDownloadCertificate = (evt: React.MouseEvent) => {
    evt.preventDefault();
    if (certificate && isValidPemCertificate(certificate)) {
      const file = new global.window.File([certificate], "fleet.pem", {
        type: "application/x-pem-file",
      });
      FileSaver.saveAs(file);
    } else {
      renderFlash(
        "error",
        "Your certificate could not be downloaded. Please check your Fleet configuration."
      );
    }
  };

  const onDownloadEnrollSecret = (evt: React.MouseEvent) => {
    evt.preventDefault();
    const file = new global.window.File([enrollSecret], "secret.txt");
    FileSaver.saveAs(file);
  };

  const onDownloadFlagfile = (evt: React.MouseEvent) => {
    evt.preventDefault();
    const file = new global.window.File([flagfileContent], "flagfile.txt");
    FileSaver.saveAs(file);
  };

  return (
    <div className={baseClass}>
      <RevealButton
        isShowing={isOpen}
        hideText="Advanced options"
        showText="Advanced options"
        caretPosition="after"
        onClick={() => setIsOpen((prev) => !prev)}
      />
      {isOpen && (
        <div className={`${baseClass}__content`}>
          {/* ChromeOS */}
          <div className={`${baseClass}__group`}>
            <h3>ChromeOS</h3>
            <p>
              Add the extension for the relevant users & browsers using the
              information below.
            </p>
            <InfoBanner>
              For a step-by-step guide, see the documentation page for{" "}
              <CustomLink
                url="https://fleetdm.com/docs/using-fleet/adding-hosts#enroll-chromebooks"
                text="adding hosts"
                newTab
                multiline
                variant="banner-link"
              />
            </InfoBanner>
            <InputField
              readOnly
              inputWrapperClass={`${baseClass}__input`}
              name="Extension ID"
              enableCopy
              label="Extension ID"
              value="fleeedmmihkfkeemmipgmhhjemlljidg"
            />
            <InputField
              readOnly
              inputWrapperClass={`${baseClass}__input`}
              name="Installation URL"
              enableCopy
              label="Installation URL"
              value="https://chrome.fleetdm.com/updates.xml"
            />
            <InputField
              readOnly
              inputWrapperClass={`${baseClass}__input`}
              name="Policy for extension"
              enableCopy
              label="Policy for extension"
              type="textarea"
              value={`{
  "fleet_url": {
    "Value": "${config?.server_settings.server_url}"
  },
  "enroll_secret": {
    "Value": "${enrollSecret}"
  }
}`}
            />
          </div>

          {/* iOS & iPadOS */}
          <div className={`${baseClass}__group`}>
            <h3>iOS & iPadOS</h3>
            <IosIpadosPanel enrollSecret={enrollSecret} />
          </div>

          {/* Android */}
          <div className={`${baseClass}__group`}>
            <h3>Android</h3>
            <AndroidPanel enrollSecret={enrollSecret} />
          </div>

          {/* Fleet certificate */}
          <div className={`${baseClass}__group`}>
            <h3>Fleet certificate</h3>
            {isFetchingCertificate && <p>Loading your certificate...</p>}
            {!isFetchingCertificate &&
              (certificate ? (
                <p>
                  Download the TLS certificate used by the Fleet server:
                  <br />
                  <Button variant="inverse" onClick={onDownloadCertificate}>
                    Download certificate
                    <Icon name="download" size="small" />
                  </Button>
                </p>
              ) : (
                <p>Fleet failed to load your certificate.</p>
              ))}
          </div>

          {/* Custom fleetctl command */}
          <div className={`${baseClass}__group`}>
            <h3>Custom package</h3>
            <InputField
              readOnly
              inputWrapperClass={`${baseClass}__input`}
              name="advanced-installer"
              enableCopy
              label="Run this command with the Fleet command-line tool"
              type="textarea"
              value={advancedCommand}
              helpText="This works for macOS, Windows, and Linux hosts."
            />
          </div>

          {/* Plain osquery */}
          <div className={`${baseClass}__group`}>
            <RevealButton
              isShowing={showPlainOsquery}
              hideText="Plain osquery"
              showText="Plain osquery"
              caretPosition="after"
              onClick={() => setShowPlainOsquery((prev) => !prev)}
            />
            {showPlainOsquery && (
              <div className={`${baseClass}__plain-osquery`}>
                <div>
                  <p>Download your enroll secret:</p>
                  <Button variant="inverse" onClick={onDownloadEnrollSecret}>
                    Download
                    <Icon name="download" size="small" />
                  </Button>
                </div>
                <div>
                  <p>Download your flagfile:</p>
                  {fetchCertificateError ? (
                    <span className={`${baseClass}__error`}>
                      {fetchCertificateError}
                    </span>
                  ) : (
                    <Button variant="inverse" onClick={onDownloadFlagfile}>
                      Download
                      <Icon name="download" size="small" />
                    </Button>
                  )}
                </div>
                <InputField
                  readOnly
                  inputWrapperClass={`${baseClass}__input`}
                  name="run-osquery"
                  enableCopy
                  label="Run osquery from the directory containing the above files:"
                  type="text"
                  value="osqueryd --flagfile=flagfile.txt --verbose"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSection;
