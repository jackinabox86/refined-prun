import { populationsStore } from '@src/infrastructure/prun-api/data/populations';
import { populationProjectsStore } from '@src/infrastructure/prun-api/data/population-projects';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { userData } from '@src/store/user-data';

// Strip capture timestamps so identical payload rewrites do not thrash userData saves.
function comparable(value: unknown) {
  return JSON.stringify(value, (key, v) =>
    key === 'capturedAt' || key === 'upkeepsCapturedAt' ? undefined : v,
  );
}

function capturePopulations() {
  for (const population of populationsStore.all.value ?? []) {
    const planet = planetsStore.all.value?.find(x => x.populationId === population.id);
    if (!planet) {
      continue;
    }

    const naturalId = planet.naturalId;
    const existing = userData.govburn.planets[naturalId];
    const buildings: UserData.GovBurnBuilding[] = population.infrastructure.map(infra => {
      const previous =
        existing?.buildings.find(x => x.projectId === infra.projectId) ??
        existing?.buildings.find(x => x.ticker === infra.ticker);
      const building: UserData.GovBurnBuilding = {
        ticker: infra.ticker,
        type: infra.type,
        projectId: infra.projectId,
        level: infra.level,
      };
      if (previous?.upkeeps !== undefined) {
        building.upkeeps = previous.upkeeps;
        building.upkeepsCapturedAt = previous.upkeepsCapturedAt;
      }
      return building;
    });

    const next: UserData.GovBurnPlanet = {
      naturalId,
      name: planet.name,
      capturedAt: Date.now(),
      buildings,
    };
    if (existing !== undefined && comparable(existing) === comparable(next)) {
      continue;
    }
    userData.govburn.planets[naturalId] = next;
  }
}

function captureProjects() {
  for (const project of populationProjectsStore.all.value ?? []) {
    for (const planet of Object.values(userData.govburn.planets)) {
      const building = planet.buildings.find(x => x.projectId === project.id);
      if (!building) {
        continue;
      }

      const upkeeps: UserData.GovBurnUpkeep[] = project.upkeeps.map(x => ({
        ticker: x.material.ticker,
        stored: x.stored,
        amount: x.amount,
        duration: x.duration,
        nextTick: x.nextTick.timestamp,
      }));
      const next = {
        level: project.level,
        upkeeps,
      };
      const previous = {
        level: building.level,
        upkeeps: building.upkeeps,
      };
      if (comparable(previous) === comparable(next)) {
        continue;
      }
      building.level = project.level;
      building.upkeeps = upkeeps;
      building.upkeepsCapturedAt = Date.now();
    }
  }
}

function init() {
  watchEffect(capturePopulations);
  watchEffect(captureProjects);
}

features.add(import.meta.url, init, 'Captures POPI/POPID data for XIT GOVBURN.');
