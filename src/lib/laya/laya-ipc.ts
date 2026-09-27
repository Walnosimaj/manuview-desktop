/**
 * Laya IPC Bridge
 * Asynchronous Inter-Process Communication channel between React frontend and local inference runtime
 */

import { LayaPayload, LayaDecisionResponse } from "./laya-engine-types";
import { executeLayaDecision } from "./laya-decision-engine";
import { isDesktopApp } from "@/lib/desktop";

/**
 * Invokes the Laya Decision Engine over the IPC channel.
 * In desktop mode (Tauri), attempts native IPC bridge execution.
 * Gracefully executes locally via the on-device engine in web preview and tests.
 */
export async function invokeDecision(payload: LayaPayload): Promise<LayaDecisionResponse> {
  if (isDesktopApp()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const serialized = JSON.stringify(payload);
      const rawResult = await invoke<string>("invoke_decision", { payload: serialized });
      if (rawResult && typeof rawResult === "string") {
        const parsed = JSON.parse(rawResult);
        const firstKey = Object.keys(payload.questions)[0];
        if (
          firstKey &&
          parsed &&
          typeof parsed === "object" &&
          firstKey in parsed &&
          ("probability" in parsed[firstKey] ||
            "selection" in parsed[firstKey] ||
            "score" in parsed[firstKey])
        ) {
          return parsed as LayaDecisionResponse;
        }
      }
    } catch (ipcErr) {
      console.debug("Tauri invoke_decision fallback to local engine:", ipcErr);
    }
  }

  // Local engine execution (100% on-device, 0 network, web & desktop compatible)
  return await executeLayaDecision(payload);
}
