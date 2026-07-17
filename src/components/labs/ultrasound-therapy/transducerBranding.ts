import type { TherapeuticTransducerType } from "@/config/therapeuticTransducerDefinitions";

export interface TransducerEngravingSpec {
  lines: string[];
}

export const TRANSDUCER_ENGRAVING: Record<TherapeuticTransducerType, TransducerEngravingSpec> = {
  planar_circular: {
    lines: ["PROGENIA ULTRASOUND", "MODEL P-100", "PLANAR", "1.0 MHz"],
  },
  focused_convergent: {
    lines: ["PROGENIA ULTRASOUND", "MODEL F-300", "FOCUSED", "3.0 MHz", "FOCUS: 30mm"],
  },
};
