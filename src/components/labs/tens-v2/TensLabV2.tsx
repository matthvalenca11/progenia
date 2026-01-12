/**
 * TensLabV2 - Página principal do laboratório TENS redesenhado
 */

import { useEffect } from "react";
import { TensLabTopBar } from "./TensLabTopBar";
import { TensLabControlPanel } from "./TensLabControlPanel";
import { TensLabInsightsPanel } from "./TensLabInsightsPanel";
import { TensLabBottomDock } from "./TensLabBottomDock";
import { Tens3DViewer } from "./Tens3DViewer";
import { useTensLabStore } from "@/stores/tensLabStore";
import { TensLabConfig, defaultTensLabConfig } from "@/types/tensLabConfig";

interface TensLabV2Props {
  config?: TensLabConfig;
  labName?: string;
  showBackButton?: boolean;
}

export function TensLabV2({ 
  config = defaultTensLabConfig, 
  labName = "Laboratório Virtual de TENS",
  showBackButton = true 
}: TensLabV2Props) {
  const { setLabConfig, runSimulation } = useTensLabStore();

  useEffect(() => {
    setLabConfig(config);
    runSimulation();
  }, [config]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <TensLabTopBar labName={labName} showBackButton={showBackButton} />

      {/* Main Content - 3 columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Control Panel */}
        <aside className="w-80 border-r shrink-0 overflow-hidden">
          <TensLabControlPanel />
        </aside>

        {/* Center - 3D Viewer */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 p-4 overflow-hidden">
            <Tens3DViewer />
          </div>
          
          {/* Bottom Dock */}
          <TensLabBottomDock />
        </main>

        {/* Right Column - Insights */}
        <aside className="w-72 border-l shrink-0 overflow-hidden">
          <TensLabInsightsPanel />
        </aside>
      </div>
    </div>
  );
}

export default TensLabV2;
