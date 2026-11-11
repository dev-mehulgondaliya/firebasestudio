"use client";

import { SDK_VERSION } from "firebase/app";

// Parent-side controller for the browser execution sandbox
// (public/sandbox/runner.html). Scripts run with an opaque origin inside a
// Web Worker, so they can reach Firestore through the Web SDK but cannot read
// Studio's session cookie, local storage or DOM.

let sequence = 0;
const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1)}`;

export class BrowserSandbox {
  constructor({ onAuthState, onStatus, onReset } = {}) {
    this.onAuthState = onAuthState || (() => {});
    this.onStatus = onStatus || (() => {});
    this.onReset = onReset || (() => {});
    this.iframe = null;
    this.status = "idle";
    this.pendingRuns = new Map();
    this.pendingAuth = new Map();
    this.loaded = null;
    this.ready = null;
    this.config = null;
    this.handleMessage = this.handleMessage.bind(this);
  }

  setStatus(status, detail) {
    this.status = status;
    this.onStatus(status, detail);
  }

  mount(container = document.body) {
    this.destroy();
    window.addEventListener("message", this.handleMessage);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("title", "Firebase Studio execution sandbox");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    iframe.src = "/sandbox/runner.html";
    this.loaded = new Promise((resolve) => {
      this.resolveLoaded = resolve;
    });
    this.iframe = iframe;
    container.appendChild(iframe);
    this.setStatus("loading");
    return this.loaded;
  }

  async init(webConfig) {
    this.config = webConfig;
    await this.loaded;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.setStatus("initializing");
    this.send({ type: "init", config: { webConfig, sdkVersion: SDK_VERSION } });
    return this.ready;
  }

  send(message) {
    this.iframe?.contentWindow?.postMessage({ ...message, __studioHost: true }, "*");
  }

  handleMessage(event) {
    if (!this.iframe || event.source !== this.iframe.contentWindow) return;
    const message = event.data;
    if (!message || message.__studioSandbox !== true) return;

    switch (message.type) {
      case "loaded":
        this.resolveLoaded?.();
        break;
      case "ready":
        this.setStatus("ready");
        this.resolveReady?.();
        break;
      case "init-error":
        this.setStatus("error", message.error?.message);
        this.rejectReady?.(new Error(message.error?.message || "Sandbox failed to initialise"));
        break;
      case "auth-state":
        this.onAuthState(message.user);
        break;
      case "auth-result": {
        const pending = this.pendingAuth.get(message.requestId);
        if (!pending) break;
        this.pendingAuth.delete(message.requestId);
        if (message.ok) pending.resolve(message.user);
        else pending.reject(Object.assign(new Error(message.error?.message || "Sign-in failed"), { code: message.error?.code }));
        break;
      }
      case "log":
        this.pendingRuns.get(message.runId)?.onLog?.(message.entry);
        break;
      case "done": {
        const pending = this.pendingRuns.get(message.runId);
        if (!pending) break;
        clearTimeout(pending.watchdog);
        this.pendingRuns.delete(message.runId);
        pending.resolve({
          status: message.status,
          result: message.result,
          error: message.error || null,
          durationMs: message.durationMs ?? 0,
        });
        break;
      }
      case "reset":
        // The worker was recreated (timeout/cancel): its auth session is gone.
        this.setStatus("initializing");
        this.ready = new Promise((resolve, reject) => {
          this.resolveReady = resolve;
          this.rejectReady = reject;
        });
        this.onAuthState(null);
        this.onReset(message.reason);
        break;
      default:
        break;
    }
  }

  async run(code, { timeoutMs = 30000, onLog } = {}) {
    await this.ready;
    const runId = nextId("run");
    return new Promise((resolve) => {
      // Last-resort guard in case the sandbox document itself stops responding.
      const watchdog = setTimeout(() => {
        this.pendingRuns.delete(runId);
        resolve({ status: "timeout", error: { name: "TimeoutError", message: "The sandbox stopped responding and was restarted." }, durationMs: timeoutMs });
        this.remount();
      }, timeoutMs + 5000);
      this.pendingRuns.set(runId, { resolve, onLog, watchdog });
      this.send({ type: "run", runId, code, timeoutMs });
    });
  }

  cancel() {
    this.send({ type: "cancel" });
  }

  auth(action, params = {}) {
    const requestId = nextId("auth");
    return new Promise((resolve, reject) => {
      this.pendingAuth.set(requestId, { resolve, reject });
      this.send({ type: "auth", action, requestId, ...params });
      setTimeout(() => {
        if (this.pendingAuth.delete(requestId)) reject(new Error("Sign-in timed out."));
      }, 30000);
    });
  }

  async remount() {
    const parent = this.iframe?.parentNode;
    const config = this.config;
    this.mount(parent || document.body);
    if (config) await this.init(config).catch(() => {});
  }

  destroy() {
    window.removeEventListener("message", this.handleMessage);
    for (const pending of this.pendingRuns.values()) {
      clearTimeout(pending.watchdog);
      pending.resolve({ status: "error", error: { name: "Cancelled", message: "Sandbox was closed." }, durationMs: 0 });
    }
    this.pendingRuns.clear();
    for (const pending of this.pendingAuth.values()) pending.reject(new Error("Sandbox was closed."));
    this.pendingAuth.clear();
    this.iframe?.remove();
    this.iframe = null;
    this.setStatus("idle");
  }
}
