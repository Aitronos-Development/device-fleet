import React, { ReactNode } from "react";
import classnames from "classnames";

import Editor from "components/Editor";
import SQLEditor from "components/SQLEditor";
import Button from "components/buttons/Button";
import Icon from "components/Icon";

const baseClass = "advanced-options-fields";

interface IAdvancedOptionsFieldsProps {
  showSchemaButton: boolean;
  installScriptTooltip?: string;
  installScriptHelpText: ReactNode;
  postInstallScriptHelpText: ReactNode;
  uninstallScriptTooltip?: string;
  uninstallScriptHelpText: ReactNode;
  errors: { preInstallQuery?: string; postInstallScript?: string };
  preInstallQuery?: string;
  installScript: string;
  postInstallScript?: string;
  uninstallScript?: string;
  className?: string;
  onClickShowSchema: () => void;
  onChangePreInstallQuery: (value?: string) => void;
  onChangeInstallScript: (value: string) => void;
  onChangePostInstallScript: (value?: string) => void;
  onChangeUninstallScript: (value?: string) => void;
  gitopsCompatible?: boolean;
  gitOpsModeEnabled?: boolean;
}

const AdvancedOptionsFields = ({
  showSchemaButton,
  installScriptTooltip,
  installScriptHelpText,
  postInstallScriptHelpText,
  uninstallScriptTooltip,
  uninstallScriptHelpText,
  errors,
  preInstallQuery,
  installScript,
  postInstallScript,
  uninstallScript,
  className,
  onClickShowSchema,
  onChangePreInstallQuery,
  onChangeInstallScript,
  onChangePostInstallScript,
  onChangeUninstallScript,
  gitopsCompatible = false,
  gitOpsModeEnabled = false,
}: IAdvancedOptionsFieldsProps) => {
  const classNames = classnames(baseClass, className);

  const disableFields = gitopsCompatible && gitOpsModeEnabled;

  const renderLabelComponent = (): JSX.Element | null => {
    if (!showSchemaButton) {
      return null;
    }

    return (
      <Button variant="inverse" onClick={onClickShowSchema}>
        Schema
        <Icon name="info" size="small" />
      </Button>
    );
  };

  return (
    <div className={classNames}>
      <SQLEditor
        className="form-field"
        focus
        error={errors.preInstallQuery}
        value={preInstallQuery}
        placeholder="SELECT 1 FROM some_table WHERE condition = 'value'"
        label="Pre-install condition (optional)"
        name="preInstallQuery"
        maxLines={10}
        onChange={onChangePreInstallQuery}
        labelActionComponent={renderLabelComponent()}
        helpText="If provided, the software will only be installed when this query finds a match on the device."
        readOnly={disableFields}
      />
      <Editor
        wrapEnabled
        maxLines={10}
        name="install-script"
        onChange={onChangeInstallScript}
        value={installScript}
        helpText={installScriptHelpText}
        label="Install script"
        labelTooltip={installScriptTooltip}
        readOnly={disableFields}
      />
      <Editor
        label="Post-install script (optional)"
        focus
        error={errors.postInstallScript}
        wrapEnabled
        name="post-install-script-editor"
        maxLines={10}
        onChange={onChangePostInstallScript}
        value={postInstallScript}
        helpText={postInstallScriptHelpText}
        readOnly={disableFields}
      />
      <Editor
        label="Uninstall script"
        labelTooltip={uninstallScriptTooltip}
        focus
        wrapEnabled
        name="uninstall-script-editor"
        maxLines={20}
        onChange={onChangeUninstallScript}
        value={uninstallScript}
        helpText={uninstallScriptHelpText}
        readOnly={disableFields}
      />
    </div>
  );
};

// Memoize to avoid unnecessary re-renders of heavy editor components
export default React.memo(AdvancedOptionsFields);
