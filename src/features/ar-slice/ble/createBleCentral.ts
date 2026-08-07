import { CapacitorBleCentral } from "@/features/ar-slice/ble/CapacitorBleCentral";
import { MockBleCentral } from "@/features/ar-slice/ble/MockBleCentral";
import type { BleCentral } from "@/features/ar-slice/ble/types";

export function createBleCentral(forceMock = false): BleCentral {
  const envMock = import.meta.env.VITE_BLE_MOCK === "true";
  if (forceMock || envMock) {
    return new MockBleCentral();
  }
  return new CapacitorBleCentral();
}
