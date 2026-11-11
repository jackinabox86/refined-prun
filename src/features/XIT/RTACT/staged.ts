export interface StagedRtRoute {
  pkg: UserData.ActionPackageData;
}

export const stagedRtRoute = ref<StagedRtRoute | undefined>(undefined);
