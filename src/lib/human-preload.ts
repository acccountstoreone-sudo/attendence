import type { Human, Config } from '@vladmandic/human';

let globalHumanInstance: Human | null = null;
let initPromise: Promise<Human> | null = null;

const config: Partial<Config> = {
  // Serve models locally to significantly reduce load times
  modelBasePath: '/models/human',
  filter: { enabled: true, equalization: false },
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 1, minConfidence: 0.4, return: true },
    mesh: { enabled: false }, // we don't need full 3d mesh
    attention: { enabled: false },
    iris: { enabled: false },
    description: { enabled: true }, // Extract 1024-dim embedding
    emotion: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
};

export async function preloadHumanModels(): Promise<Human> {
  if (globalHumanInstance) return globalHumanInstance;
  if (initPromise) return initPromise;

  initPromise = new Promise(async (resolve, reject) => {
    try {
      const { Human } = await import('@vladmandic/human');
      const human = new Human(config);
      // Load and warmup
      await human.load();
      await human.warmup(); // Warmup compiles WebGL shaders
      globalHumanInstance = human;
      resolve(human);
    } catch (err) {
      console.error('Failed to preload Human API:', err);
      initPromise = null;
      reject(err);
    }
  });

  return initPromise;
}

export function getHumanInstance(): Human | null {
  return globalHumanInstance;
}
