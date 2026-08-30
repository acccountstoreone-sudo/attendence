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
      
      // Load models with a timeout to prevent hanging forever
      const loadWithTimeout = Promise.race([
        human.load(),
        new Promise((_, r) => setTimeout(() => r(new Error('Model load timeout')), 15000))
      ]);
      await loadWithTimeout;

      // Skip warmup on mobile browsers (especially Firefox Android) to prevent WebGL deadlocks.
      // Warmup compiles shaders, which can silently hang certain mobile GPUs.
      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
      if (!isMobile) {
        try {
          const warmupWithTimeout = Promise.race([
            human.warmup(),
            new Promise((_, r) => setTimeout(() => r(new Error('Warmup timeout')), 5000))
          ]);
          await warmupWithTimeout;
        } catch (warmupErr) {
          console.warn('Warmup skipped or timed out:', warmupErr);
        }
      }
      
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

