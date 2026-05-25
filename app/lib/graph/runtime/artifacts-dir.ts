// Resolve where generated preview artifacts are written on disk.
export function artifactsDir(): string {
  return process.env.ARTIFACTS_DIR ?? "./artifacts";
}
