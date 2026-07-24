export async function toggleGame3D() {
  try {
    const { launchGame3D } = await import('@src/game-3d');
    launchGame3D();
  } catch (err) {
    console.error('[game-3d] failed to launch', err);
  }
}
