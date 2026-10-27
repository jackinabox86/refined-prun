export interface StagedRtRoute {
  pkg: UserData.ActionPackageData;
}

export const stagedRtRoute = ref<StagedRtRoute | undefined>(undefined);

// ROUTECONFIG PREVIEW off staging: the step list RTEXEC would run, for XIT RTPREVIEW.
export interface PreviewedRtRoute {
  name: string;
  lines: string[];
}

export const previewedRtRoute = ref<PreviewedRtRoute | undefined>(undefined);
