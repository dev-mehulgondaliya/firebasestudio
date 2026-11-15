// The stable Node.js permission model (`--permission`) landed in Node 22.13.
// Node 20 only exposes `--experimental-permission`; Node 18 has no permission
// model at all. Server execution is fail-closed without it: user scripts must
// never run on the Studio host without file-system and process restrictions.
export function permissionModelAvailable() {
  return process.allowedNodeEnvironmentFlags.has("--permission");
}
