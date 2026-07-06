/**
 * Computes the Euclidean distance between two 128-dimensional Float32 arrays.
 * A distance < 0.6 is generally considered a match for face-api.js descriptors.
 */
export function getEuclideanDistance(descriptor1: number[], descriptor2: number[]): number {
  if (!descriptor1 || !descriptor2 || descriptor1.length !== descriptor2.length) {
    throw new Error('Descriptors must have the same length');
  }
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
