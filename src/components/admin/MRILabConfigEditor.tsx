/**
 * MRI Lab Config Editor
 */

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MRILabConfig, MRIPreset, MRIViewerType } from "@/types/mriLabConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface MRILabConfigEditorProps {
  config: MRILabConfig;
  onChange: (config: MRILabConfig) => void;
}

export function MRILabConfigEditor({ config, onChange }: MRILabConfigEditorProps) {
  const updateConfig = (updates: Partial<MRILabConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração do Lab de MRI</CardTitle>
        <CardDescription>
          Configure os parâmetros de aquisição e visualização do simulador de ressonância magnética
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Presets */}
        <div className="space-y-2">
          <Label>Preset Padrão</Label>
          <Select
            value={config.preset}
            onValueChange={(v) => updateConfig({ preset: v as MRIPreset })}
            disabled={!config.enabledControls.preset}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="t1_weighted">T1-weighted</SelectItem>
              <SelectItem value="t2_weighted">T2-weighted</SelectItem>
              <SelectItem value="proton_density">Proton Density</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Acquisition Parameters */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Parâmetros de Aquisição</Label>

          {config.enabledControls.tr && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>TR (Repetition Time)</Label>
                <span className="text-sm text-muted-foreground">
                  {config.tr} ms
                </span>
              </div>
              <Slider
                value={[config.tr]}
                onValueChange={(v) => updateConfig({ tr: v[0] })}
                min={config.ranges.tr.min}
                max={config.ranges.tr.max}
                step={10}
              />
            </div>
          )}

          {config.enabledControls.te && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>TE (Echo Time)</Label>
                <span className="text-sm text-muted-foreground">
                  {config.te} ms
                </span>
              </div>
              <Slider
                value={[config.te]}
                onValueChange={(v) => updateConfig({ te: v[0] })}
                min={config.ranges.te.min}
                max={config.ranges.te.max}
                step={1}
              />
            </div>
          )}

          {config.enabledControls.flipAngle && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Flip Angle</Label>
                <span className="text-sm text-muted-foreground">
                  {config.flipAngle}°
                </span>
              </div>
              <Slider
                value={[config.flipAngle]}
                onValueChange={(v) => updateConfig({ flipAngle: v[0] })}
                min={config.ranges.flipAngle.min}
                max={config.ranges.flipAngle.max}
                step={5}
              />
            </div>
          )}

          {config.enabledControls.sequenceType && (
            <div className="space-y-2">
              <Label>Tipo de Sequência</Label>
              <Select
                value={config.sequenceType}
                onValueChange={(v) => updateConfig({ sequenceType: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spin_echo">Spin Echo</SelectItem>
                  <SelectItem value="gradient_echo">Gradient Echo</SelectItem>
                  <SelectItem value="inversion_recovery">Inversion Recovery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Viewer Selection */}
        {config.enabledControls.viewer && (
          <div className="space-y-2">
            <Label>Visualização Padrão</Label>
            <Select
              value={config.activeViewer}
              onValueChange={(v) => updateConfig({ activeViewer: v as MRIViewerType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="magnetization">Magnetização 3D</SelectItem>
                <SelectItem value="slice_2d">Fatia 2D</SelectItem>
                <SelectItem value="volume_3d">Volume 3D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Enabled Controls */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Controles Habilitados</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-preset" className="text-sm font-normal">
                Preset
              </Label>
              <Switch
                id="enable-preset"
                checked={config.enabledControls.preset}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, preset: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-tr" className="text-sm font-normal">
                TR
              </Label>
              <Switch
                id="enable-tr"
                checked={config.enabledControls.tr}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, tr: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-te" className="text-sm font-normal">
                TE
              </Label>
              <Switch
                id="enable-te"
                checked={config.enabledControls.te}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, te: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-flip" className="text-sm font-normal">
                Flip Angle
              </Label>
              <Switch
                id="enable-flip"
                checked={config.enabledControls.flipAngle}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, flipAngle: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-sequence" className="text-sm font-normal">
                Tipo de Sequência
              </Label>
              <Switch
                id="enable-sequence"
                checked={config.enabledControls.sequenceType}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, sequenceType: checked },
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-viewer" className="text-sm font-normal">
                Seleção de Viewer
              </Label>
              <Switch
                id="enable-viewer"
                checked={config.enabledControls.viewer}
                onCheckedChange={(checked) =>
                  updateConfig({
                    enabledControls: { ...config.enabledControls, viewer: checked },
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Ranges */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Faixas de Valores</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">TR (ms)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <input
                    type="number"
                    value={config.ranges.tr.min}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          tr: { ...config.ranges.tr, min: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <input
                    type="number"
                    value={config.ranges.tr.max}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          tr: { ...config.ranges.tr, max: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">TE (ms)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <input
                    type="number"
                    value={config.ranges.te.min}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          te: { ...config.ranges.te, min: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <input
                    type="number"
                    value={config.ranges.te.max}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          te: { ...config.ranges.te, max: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Flip Angle (°)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <input
                    type="number"
                    value={config.ranges.flipAngle.min}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          flipAngle: { ...config.ranges.flipAngle, min: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <input
                    type="number"
                    value={config.ranges.flipAngle.max}
                    onChange={(e) =>
                      updateConfig({
                        ranges: {
                          ...config.ranges,
                          flipAngle: { ...config.ranges.flipAngle, max: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
