// A connection's type decides where its scripts run:
//  - web   → "browser": sandboxed iframe + Firebase Web SDK, security rules enforced
//  - admin → "server":  isolated Node.js worker + Firebase Admin SDK, bypasses rules
export function executionModeFor(connection) {
  return connection?.connectionType === "admin" ? "server" : "browser";
}

export const EXECUTION_MODE_LABELS = {
  browser: "Browser · Web SDK",
  server: "Server · Admin SDK",
};
