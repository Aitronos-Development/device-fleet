import React from "react";
import { noop } from "lodash";

import Modal from "components/Modal";
import Button from "components/buttons/Button";
import Icon from "components/Icon";
import Spinner from "components/Spinner";

import { IMultiTeamDeployResult } from "../../../SoftwareAddPage/multiTeamDeploy";

const baseClass = "multi-team-deploy-progress-modal";

interface IMultiTeamDeployProgressModalProps {
  results: IMultiTeamDeployResult[];
  onDone: () => void;
  isComplete: boolean;
}

const StatusIcon = ({
  status,
}: {
  status: IMultiTeamDeployResult["status"];
}) => {
  switch (status) {
    case "pending":
      return (
        <Icon name="pending-outline" className={`${baseClass}__status-icon`} />
      );
    case "in_progress":
      return (
        <Spinner
          size="x-small"
          centered={false}
          includeContainer={false}
          className={`${baseClass}__status-spinner`}
        />
      );
    case "success":
      return <Icon name="success" className={`${baseClass}__status-icon`} />;
    case "error":
      return <Icon name="error" className={`${baseClass}__status-icon`} />;
    default:
      return null;
  }
};

const MultiTeamDeployProgressModal = ({
  results,
  onDone,
  isComplete,
}: IMultiTeamDeployProgressModalProps) => {
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <Modal
      title="Adding software to teams"
      onExit={isComplete ? onDone : noop}
      className={baseClass}
    >
      <>
        <div className={`${baseClass}__progress-list`}>
          {results.map((result) => (
            <div key={result.teamId} className={`${baseClass}__team-row`}>
              <StatusIcon status={result.status} />
              <span className={`${baseClass}__team-name`}>
                {result.teamName}
              </span>
              {result.error && (
                <span className={`${baseClass}__team-error`}>
                  {result.error}
                </span>
              )}
            </div>
          ))}
        </div>
        {isComplete && (
          <>
            <p className={`${baseClass}__summary`}>
              {successCount} of {results.length} team
              {results.length !== 1 ? "s" : ""} succeeded.
              {errorCount > 0 && ` ${errorCount} failed.`}
            </p>
            <div className="modal-cta-wrap">
              <Button onClick={onDone}>Done</Button>
            </div>
          </>
        )}
      </>
    </Modal>
  );
};

export default MultiTeamDeployProgressModal;
