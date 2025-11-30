import { TissueConfig, RiskResult } from "@/types/tissueConfig";
import { TensParams } from "./tensSimulation";

/**
 * Simula os riscos associados à aplicação de TENS em uma configuração anatômica específica.
 * Esta é uma simulação educativa simplificada, não deve ser usada para decisões clínicas reais.
 */
export function simulateTissueRisk(
  tensParams: TensParams,
  tissue: TissueConfig
): RiskResult {
  if (!tissue.enableRiskSimulation) {
    return {
      riskScore: 0,
      riskLevel: "baixo",
      messages: ["Simulação de risco desativada para este cenário."],
    };
  }

  let riskScore = 0;
  const messages: string[] = [];

  // Normalizar parâmetros TENS
  const intensityNorm = tensParams.intensitymA / 100; // 0-1
  const frequencyNorm = tensParams.frequencyHz / 150; // 0-1
  const pulseWidthNorm = tensParams.pulseWidthUs / 400; // 0-1

  // 1. RISCO: Implante metálico + alta intensidade
  if (tissue.hasMetalImplant && tissue.metalImplantDepth !== undefined) {
    const metalRisk = intensityNorm * (tissue.metalImplantSpan || 0.5) * 40;
    riskScore += metalRisk;
    
    if (intensityNorm > 0.6) {
      messages.push(
        "⚠️ ALERTA: Implante metálico detectado. Alta intensidade pode causar aquecimento localizado e desconforto severo."
      );
    } else if (intensityNorm > 0.3) {
      messages.push(
        "⚡ CUIDADO: Implante metálico presente. Monitore sensações de aquecimento ou formigamento excessivo."
      );
    }
  }

  // 2. RISCO: Camada adiposa muito espessa com baixa intensidade
  if (tissue.fatThickness > 0.6 && intensityNorm < 0.3) {
    messages.push(
      "📊 INFO: Camada adiposa espessa. Intensidade baixa pode resultar em estimulação superficial insuficiente."
    );
    riskScore += 5; // Risco mínimo, mais uma observação
  }

  // 3. RISCO: Osso muito superficial + alta intensidade
  if (tissue.boneDepth < 0.4 && intensityNorm > 0.7) {
    const boneRisk = (1 - tissue.boneDepth) * intensityNorm * 25;
    riskScore += boneRisk;
    messages.push(
      "⚠️ ATENÇÃO: Estrutura óssea superficial. Alta intensidade pode causar desconforto periosteal."
    );
  }

  // 4. BENEFÍCIO: Músculo espesso permite penetração segura
  if (tissue.muscleThickness > 0.5 && intensityNorm < 0.7) {
    messages.push(
      "✅ IDEAL: Camada muscular adequada permite boa profundidade de estimulação com segurança."
    );
    riskScore -= 10; // Reduz risco
  }

  // 5. RISCO: Frequência muito alta + largura de pulso longa
  if (frequencyNorm > 0.8 && pulseWidthNorm > 0.7) {
    const overloadRisk = frequencyNorm * pulseWidthNorm * 20;
    riskScore += overloadRisk;
    messages.push(
      "⚡ CUIDADO: Combinação de alta frequência e pulso longo pode causar fadiga muscular ou desconforto."
    );
  }

  // 6. RISCO: Pele muito fina + alta intensidade
  if (tissue.skinThickness < 0.2 && intensityNorm > 0.6) {
    const skinRisk = (1 - tissue.skinThickness) * intensityNorm * 15;
    riskScore += skinRisk;
    messages.push(
      "⚠️ ATENÇÃO: Pele fina. Alta intensidade pode causar irritação cutânea. Use gel condutor adequado."
    );
  }

  // 7. MODO específico + tecido
  if (tensParams.mode === "burst" && tissue.tissueType === "soft") {
    messages.push(
      "💡 DICA: Modo burst em tecido mole pode ser desconfortável. Considere modo convencional."
    );
    riskScore += 5;
  }

  if (tensParams.mode === "acupuntura" && tissue.muscleThickness > 0.6) {
    messages.push(
      "✅ BOM: Modo acupuntura em músculo espesso é ideal para liberação de endorfinas."
    );
    riskScore -= 5;
  }

  // Garantir que riskScore esteja entre 0-100
  riskScore = Math.max(0, Math.min(100, riskScore));

  // Determinar nível de risco
  let riskLevel: RiskResult["riskLevel"];
  if (riskScore < 30) {
    riskLevel = "baixo";
    if (messages.length === 0) {
      messages.push("✅ Configuração segura. Parâmetros dentro dos limites recomendados.");
    }
  } else if (riskScore < 70) {
    riskLevel = "moderado";
  } else {
    riskLevel = "alto";
  }

  return {
    riskScore: Math.round(riskScore),
    riskLevel,
    messages: messages.slice(0, 3), // Máximo 3 mensagens
  };
}
