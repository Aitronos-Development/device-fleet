# Plan: Improve Software Management from "All Teams" View

## Context

When "All teams" is selected on the Software page, the "Add software" button is disabled with a dead-end tooltip saying "Select a team to add software." Users who want to manage default software across all devices are stuck — they must manually switch to each team. This makes it hard for non-technical users to understand the workflow and manage software at scale.

Software in Fleet is stored per-team in the database (`software_installers.team_id`). There's no "global" software concept, so adding software always requires a team. We'll improve the UX in two ways:

1. **Team picker modal** — When clicking "Add software" from "All teams", show a dropdown to pick a team and go straight to the add flow
2. **Multi-team deploy** — Allow selecting multiple teams and deploying the same software to all of them at once

## Implementation

### Step 1: Transform AddSoftwareModal into a Team Picker

**File: [AddSoftwareModal.tsx](frontend/pages/SoftwarePage/components/modals/AddSoftwareModal/AddSoftwareModal.tsx)**

Replace the dead-end `AllTeamsMessage` component with a team selection UI:
- Add a `Checkbox` list of teams (reusing the pattern from `TargetLabelSelector`)
- "Select all" / "Deselect all" links above the list
- "Continue (N teams)" button at the bottom, disabled when none selected
- If exactly 1 team selected → navigate to add software page with `team_id=X`
- If multiple teams selected → navigate with `team_ids=X,Y,Z`

New props: `userTeams: ITeamSummary[]`, `onTeamsSelected: (teamIds: number[]) => void`

Imports to add: `useState` from React, `Checkbox` from `components/forms/fields/Checkbox`, `ITeamSummary` from `interfaces/team`

### Step 2: Enable the "Add software" Button for All Teams

**File: [SoftwarePage.tsx](frontend/pages/SoftwarePage/SoftwarePage.tsx)**

- **Line 377-381**: Remove `disabled={isAllTeamsSelected}` from the button. The `onAddSoftware` callback (line 275) already opens the modal for all-teams, so it works as-is.
- **Lines 367-384**: Simplify the tooltip wrapper — only show the free-tier tooltip, not the "select a team" tooltip.
- **Lines 483-488**: Pass `userTeams` and a new `onTeamsSelected` handler to `AddSoftwareModal`.
- Add `onTeamsSelected` callback that closes modal and navigates:
  - 1 team: `router.push(PATHS.SOFTWARE_ADD_FLEET_MAINTAINED + ?team_id=X)`
  - Multiple: `router.push(PATHS.SOFTWARE_ADD_FLEET_MAINTAINED + ?team_ids=X,Y,Z)`

`userTeams` is already available (line 191) from `useTeamIdParam`.

### Step 3: Support `team_ids` Query Param in SoftwareAddPage

**File: [SoftwareAddPage.tsx](frontend/pages/SoftwarePage/SoftwareAddPage/SoftwareAddPage.tsx)**

- Add `team_ids` to `ISoftwareAddPageQueryParams`
- Parse `team_ids` from URL: split on comma, convert to `number[]`
- If `team_ids` present, use first team as `currentTeamId` (for labels, form context) and pass full `teamIds` array to children via `React.cloneElement`
- Pass `isMultiTeam: boolean` flag to children
- Preserve `team_ids` param when navigating between tabs (line 77)
- Back button should go to "All teams" software view when multi-team

### Step 4: Create Multi-Team Deploy Utility

**New file: [multiTeamDeploy.ts](frontend/pages/SoftwarePage/SoftwareAddPage/multiTeamDeploy.ts)**

```typescript
export interface IMultiTeamDeployResult {
  teamId: number;
  teamName: string;
  status: "pending" | "in_progress" | "success" | "error";
  error?: string;
}

export const deployToMultipleTeams = async (
  teamIds: number[],
  teamNames: Record<number, string>,
  deployFn: (teamId: number) => Promise<void>,
  onProgress: (results: IMultiTeamDeployResult[]) => void
): Promise<IMultiTeamDeployResult[]>
```

Calls `deployFn` sequentially for each team, updating progress after each. Continues on failure (partial success is OK).

### Step 5: Create MultiTeamDeployProgressModal

**New file: [MultiTeamDeployProgressModal.tsx](frontend/pages/SoftwarePage/components/modals/MultiTeamDeployProgressModal/MultiTeamDeployProgressModal.tsx)**

A modal showing a list of teams with status icons:
- Pending: clock icon
- In progress: spinner
- Success: checkmark
- Error: X icon with error message

Footer shows "N of M teams succeeded" when complete, with a "Done" button that navigates back to the All teams software view.

### Step 6: Modify Add Software Child Pages for Multi-Team Submit

Each of these pages needs a small addition to their `onSubmit` handler: if `isMultiTeam && teamIds.length > 1`, loop via `deployToMultipleTeams` and show the progress modal instead of the normal single-team flow.

Files to modify (same pattern in each):
- [FleetMaintainedAppDetailsPage.tsx](frontend/pages/SoftwarePage/SoftwareAddPage/SoftwareFleetMaintained/FleetMaintainedAppDetailsPage/FleetMaintainedAppDetailsPage.tsx)
- [SoftwareCustomPackage.tsx](frontend/pages/SoftwarePage/SoftwareAddPage/SoftwareCustomPackage/SoftwareCustomPackage.tsx)
- [SoftwareAppStoreVpp.tsx](frontend/pages/SoftwarePage/SoftwareAddPage/SoftwareAppStore/SoftwareAppStoreVpp/SoftwareAppStoreVpp.tsx)

Each page already has an `onSubmit` that calls the API with a single `teamId`. We add:
- Accept `teamIds?: number[]` and `isMultiTeam?: boolean` props (from `cloneElement` in SoftwareAddPage)
- New state: `deployResults`, `isDeployComplete`, `showProgressModal`
- In `onSubmit`: if `isMultiTeam`, call `deployToMultipleTeams` with the existing API function, show progress modal
- Otherwise: existing single-team logic unchanged

### Step 7: Add Styles

**File: [AddSoftwareModal/_styles.scss](frontend/pages/SoftwarePage/components/modals/AddSoftwareModal/_styles.scss)**
- Team checkbox list with scrollable container (max-height for many teams)
- Select all / deselect all links

**New file: [MultiTeamDeployProgressModal/_styles.scss](frontend/pages/SoftwarePage/components/modals/MultiTeamDeployProgressModal/_styles.scss)**
- Team row with icon + name + optional error
- Spacing and alignment

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `AddSoftwareModal.tsx` | Modify | Replace dead-end message with team checkbox picker |
| `AddSoftwareModal/_styles.scss` | Modify | Add styles for team picker |
| `SoftwarePage.tsx` | Modify | Enable button for all-teams, pass props to modal |
| `SoftwareAddPage.tsx` | Modify | Parse `team_ids`, pass to children |
| `multiTeamDeploy.ts` | Create | Shared deploy utility |
| `MultiTeamDeployProgressModal.tsx` | Create | Progress modal component |
| `MultiTeamDeployProgressModal/_styles.scss` | Create | Progress modal styles |
| `FleetMaintainedAppDetailsPage.tsx` | Modify | Multi-team submit support |
| `SoftwareCustomPackage.tsx` | Modify | Multi-team submit support |
| `SoftwareAppStoreVpp.tsx` | Modify | Multi-team submit support |

## Edge Cases

- **Labels differ per team**: For multi-team deploy, label-based targeting is skipped (use "All hosts" target). A note in the UI explains this.
- **Partial failures**: Progress modal shows per-team status. User can retry failed teams individually.
- **File upload for custom packages**: The `File` object reference persists in memory, so it can be re-uploaded for each team in the loop.
- **VPP apps**: Some apps may not be available for certain teams. The error from the API will be shown per-team in the progress modal.

## Verification

1. **Team picker**: Click "Add software" from "All teams" → see team checkboxes → select one → lands on add software page with correct `team_id`
2. **Multi-team**: Select 3 teams → complete the add form → progress modal shows 3 rows updating sequentially → all succeed → click Done → back to All teams view
3. **Partial failure**: Disconnect a team or use invalid data → progress modal shows which teams failed → click Done → flash message
4. **Free tier**: "Add software" from All teams still shows premium feature message
5. Run `yarn lint` and `yarn test` to verify no regressions
