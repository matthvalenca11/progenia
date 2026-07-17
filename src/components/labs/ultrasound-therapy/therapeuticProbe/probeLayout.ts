import { Vector3 } from "three";

/** Inclinação da haste (~32°) */
export const HANDLE_TILT = 0.56;

export interface ProbeLayout {
  faceTopY: number;
  neckTopY: number;
  capR: number;
  capLen: number;
  buttonPos: [number, number, number];
  ledPos: Vector3;
}

export function computeProbeLayout(
  faceBottomY: number,
  faceH: number,
  neckH: number,
  handleR: number,
  handleLen: number,
): ProbeLayout {
  const faceTopY = faceBottomY + faceH;
  const neckTopY = faceTopY + neckH;
  const capR = handleR;
  const capLen = handleLen;

  const buttonPos: [number, number, number] = [
    capR * 0.88,
    capR + capLen * 0.38,
    capR * 0.42,
  ];

  const ledPos = new Vector3(
    -capR * 0.75,
    capR + capLen * 0.22,
    capR * 0.28,
  );

  return { faceTopY, neckTopY, capR, capLen, buttonPos, ledPos };
}
