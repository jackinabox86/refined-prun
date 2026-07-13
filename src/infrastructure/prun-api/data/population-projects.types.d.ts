declare namespace PrunApi {
  interface PopulationProject {
    id: string;
    type: string;
    projectIdentifier: string;
    level: number;
    activeLevel: number;
    currentLevel: number;
    upkeeps: PopulationProjectUpkeep[];
  }

  interface PopulationProjectUpkeep {
    stored: number;
    storeCapacity: number;
    duration: number;
    nextTick: DateTime;
    material: Material;
    amount: number;
    currentAmount: number;
  }
}
