import React, { useState } from "react";

import { ITeamSummary, APP_CONTEXT_NO_TEAM_ID } from "interfaces/team";

import Modal from "components/Modal";
import Button from "components/buttons/Button";
import Checkbox from "components/forms/fields/Checkbox";
import PremiumFeatureMessage from "components/PremiumFeatureMessage";

const baseClass = "add-software-modal";

interface ITeamPickerContentProps {
  userTeams: ITeamSummary[];
  onExit: () => void;
  onTeamsSelected: (teamIds: number[]) => void;
}

const TeamPickerContent = ({
  userTeams,
  onExit,
  onTeamsSelected,
}: ITeamPickerContentProps) => {
  const [selectedTeamIds, setSelectedTeamIds] = useState<
    Record<number, boolean>
  >({});

  const actualTeams = userTeams.filter((t) => t.id > APP_CONTEXT_NO_TEAM_ID);

  const handleToggleTeam = ({
    name,
    value,
  }: {
    name: string;
    value: boolean;
  }) => {
    const teamId = parseInt(name, 10);
    setSelectedTeamIds((prev) => ({ ...prev, [teamId]: value }));
  };

  const selectedCount = Object.values(selectedTeamIds).filter(Boolean).length;

  const handleSelectAll = () => {
    const allSelected = actualTeams.reduce<Record<number, boolean>>(
      (acc, t) => {
        acc[t.id] = true;
        return acc;
      },
      {}
    );
    setSelectedTeamIds(allSelected);
  };

  const handleDeselectAll = () => setSelectedTeamIds({});

  const handleContinue = () => {
    const ids = Object.entries(selectedTeamIds)
      .filter(([, selected]) => selected)
      .map(([id]) => parseInt(id, 10));
    onTeamsSelected(ids);
  };

  return (
    <>
      <p>Select one or more teams to add software to.</p>
      <div className={`${baseClass}__select-actions`}>
        <Button variant="text-link" onClick={handleSelectAll}>
          Select all
        </Button>
        <Button variant="text-link" onClick={handleDeselectAll}>
          Deselect all
        </Button>
      </div>
      <div className={`${baseClass}__team-checkboxes`}>
        {actualTeams.map((team) => (
          <Checkbox
            key={team.id}
            name={team.id.toString()}
            value={!!selectedTeamIds[team.id]}
            onChange={handleToggleTeam}
            parseTarget
          >
            {team.name}
          </Checkbox>
        ))}
      </div>
      <div className="modal-cta-wrap">
        <Button disabled={selectedCount === 0} onClick={handleContinue}>
          {selectedCount > 1 ? `Continue (${selectedCount} teams)` : "Continue"}
        </Button>
        <Button onClick={onExit} variant="inverse">
          Cancel
        </Button>
      </div>
    </>
  );
};

interface IAddSoftwareModalProps {
  onExit: () => void;
  isFreeTier?: boolean;
  userTeams?: ITeamSummary[];
  onTeamsSelected?: (teamIds: number[]) => void;
}

const AddSoftwareModal = ({
  onExit,
  isFreeTier,
  userTeams = [],
  onTeamsSelected,
}: IAddSoftwareModalProps) => {
  const renderModalContent = () => {
    if (isFreeTier) {
      return (
        <>
          <PremiumFeatureMessage alignment="left" />{" "}
          <div className="modal-cta-wrap">
            <Button onClick={onExit}>Done</Button>
          </div>
        </>
      );
    }

    return (
      <TeamPickerContent
        userTeams={userTeams}
        onExit={onExit}
        onTeamsSelected={onTeamsSelected || onExit}
      />
    );
  };

  return (
    <Modal title="Add software" onExit={onExit} className={baseClass}>
      {renderModalContent()}
    </Modal>
  );
};

export default AddSoftwareModal;
