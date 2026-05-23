export function artifactsDir(): string {
  return process.env.ARTIFACTS_DIR ?? "./artifacts";
}
