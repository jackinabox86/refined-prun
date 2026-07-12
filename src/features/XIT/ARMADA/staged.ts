import type { ArmadaBaseConfig } from '@src/features/XIT/ARMADA/utils';

export interface StagedOffload {
  naturalId: string;
  planetName: string;
  config: ArmadaBaseConfig;
  // Serialized ship cargo store, e.g. "3KA Cargo".
  cargo: string;
  // Stage-time bill — offloads must match what the MTRAs ship.
  materials: Record<string, number>;
}

export interface StagedArmada {
  pkg: UserData.ActionPackageData;
  offloads: StagedOffload[];
}

export const stagedArmada = ref<StagedArmada | undefined>(undefined);
