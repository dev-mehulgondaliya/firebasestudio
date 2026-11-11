import { json, readJson, route } from "@/lib/api/http";
import { isEncryptionConfigured } from "@/lib/security/encryption";
import { isServerExecutionEnabled } from "@/lib/security/permissions";
import { permissionModelAvailable } from "@/lib/execution/server-runner";
import { getSettings, getStore, updateSettings } from "@/lib/studio-db";
import { settingsSchema } from "@/lib/validators";

function environment() {
  const store = getStore();
  return {
    storage: store.kind,
    storageLocation: store.location,
    encryptionConfigured: isEncryptionConfigured(),
    serverExecutionEnabled: isServerExecutionEnabled(),
    workerPermissionModel: permissionModelAvailable(),
    nodeVersion: process.version,
  };
}

export const GET = route(async ({ user }) => {
  return json({ user, settings: await getSettings(user.uid), environment: environment() });
});

export const PUT = route(async ({ request, user }) => {
  const patch = await readJson(request, settingsSchema);
  return json({ settings: await updateSettings(user.uid, patch) });
});
