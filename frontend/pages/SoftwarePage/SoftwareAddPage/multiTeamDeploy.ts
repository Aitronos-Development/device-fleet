import { getErrorReason } from "interfaces/errors";

export interface IMultiTeamDeployResult {
  teamId: number;
  teamName: string;
  status: "pending" | "in_progress" | "success" | "error";
  error?: string;
}

/**
 * Deploys software to multiple teams sequentially, reporting progress after
 * each team. Continues on failure so partial successes are possible.
 */
export const deployToMultipleTeams = async (
  teamIds: number[],
  teamNames: Record<number, string>,
  deployFn: (teamId: number) => Promise<void>,
  onProgress: (results: IMultiTeamDeployResult[]) => void
): Promise<IMultiTeamDeployResult[]> => {
  const results: IMultiTeamDeployResult[] = teamIds.map((id) => ({
    teamId: id,
    teamName: teamNames[id] || `Team ${id}`,
    status: "pending" as const,
  }));

  onProgress([...results]);

  // Sequential deployment is intentional — we want to show progress one team
  // at a time and avoid overwhelming the server with parallel uploads.
  for (let i = 0; i < teamIds.length; i += 1) {
    results[i] = { ...results[i], status: "in_progress" };
    onProgress([...results]);

    try {
      // eslint-disable-next-line no-await-in-loop
      await deployFn(teamIds[i]);
      results[i] = { ...results[i], status: "success" };
    } catch (err) {
      results[i] = {
        ...results[i],
        status: "error",
        error: getErrorReason(err) || "Unknown error",
      };
    }

    onProgress([...results]);
  }

  return results;
};
