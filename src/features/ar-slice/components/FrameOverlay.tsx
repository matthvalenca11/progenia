import { useArSliceStore } from "@/features/ar-slice/arSliceStore";

/** SVG overlay for the tracked hand/sensor region. */
export function FrameOverlay() {
  const corners = useArSliceStore((s) => s.frameCorners);
  const state = useArSliceStore((s) => s.frameTrackState);
  const enabled = useArSliceStore((s) => s.frameTrackingEnabled);
  const confidence = useArSliceStore((s) => s.frameConfidence);

  if (!enabled || state === "off") return null;

  const color = state === "locked" ? "#22d3ee" : state === "lost" ? "#f59e0b" : "#94a3b8";

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* Search guide — keep the sensor-holding hand here. */}
      {(state === "searching" || state === "lost") && (
        <rect
          x="18"
          y="22"
          width="64"
          height="48"
          rx="1.5"
          fill="none"
          stroke={color}
          strokeWidth="0.45"
          strokeDasharray="2.5 1.8"
          opacity={0.75}
        />
      )}

      {corners && (state === "locked" || state === "lost") && (
        <>
          <polygon
            points={corners.map((c) => `${c.x * 100},${c.y * 100}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="0.6"
            strokeLinejoin="round"
            opacity={0.95}
          />
          {corners.map((c, i) => (
            <circle key={i} cx={c.x * 100} cy={c.y * 100} r="1.1" fill={color} />
          ))}
        </>
      )}

      {state === "locked" && (
        <text x="50" y="8" textAnchor="middle" fill="#22d3ee" fontSize="3.2" opacity={0.9}>
          mão + sensor {Math.round(confidence * 100)}%
        </text>
      )}
      {state === "searching" && (
        <text x="50" y="8" textAnchor="middle" fill="#94a3b8" fontSize="3.2" opacity={0.9}>
          mantenha a mão com o sensor nesta área
        </text>
      )}
    </svg>
  );
}
