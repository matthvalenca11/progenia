import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  extractUltrasoundVideoProfileFromUrl,
  type UltrasoundVideoProfile,
} from '@/simulator/ultrasound/UltrasoundVideoFeatureExtractor';
import { applyVideoProfileToLabStore } from '@/simulator/ultrasound/applyVideoProfileToLab';
import { useUltrasoundLabStore } from '@/stores/ultrasoundLabStore';
import { isYouTubeUrl } from '@/lib/youtube';

interface UltrasoundVideoFeaturePanelProps {
  videoUrl?: string;
}

const TRANSDUCER_LABELS: Record<string, string> = {
  linear: 'Linear',
  convex: 'Convexo',
  microconvex: 'Microconvexo',
  unknown: 'Indeterminado',
};

function ProfileSummary({ profile }: { profile: UltrasoundVideoProfile }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div>
        <span className="text-muted-foreground">Transdutor</span>
        <p className="font-medium">
          {TRANSDUCER_LABELS[profile.transducerType] ?? profile.transducerType}
          <span className="text-muted-foreground ml-1">
            ({Math.round(profile.transducerConfidence * 100)}%)
          </span>
        </p>
      </div>
      <div>
        <span className="text-muted-foreground">Profundidade</span>
        <p className="font-medium">{profile.depthCm} cm</p>
      </div>
      <div>
        <span className="text-muted-foreground">Ganho</span>
        <p className="font-medium">{profile.gain}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Frequência</span>
        <p className="font-medium">{profile.frequencyMHz} MHz</p>
      </div>
      <div>
        <span className="text-muted-foreground">Speckle</span>
        <p className="font-medium">{profile.speckleIntensity}</p>
      </div>
      <div>
        <span className="text-muted-foreground">Frames</span>
        <p className="font-medium">{profile.framesAnalyzed}</p>
      </div>
      <div className="col-span-2 flex flex-wrap gap-1 pt-1">
        {profile.acousticShadowScore > 0.04 && (
          <Badge variant="secondary">Sombra acústica</Badge>
        )}
        {profile.nearFieldClutterScore > 0.35 && (
          <Badge variant="secondary">Clutter near-field</Badge>
        )}
        {profile.reverberationScore > 0.25 && (
          <Badge variant="secondary">Reverberação</Badge>
        )}
        {profile.pulsationScore > 0.15 && (
          <Badge variant="secondary">Pulsação vascular</Badge>
        )}
        {profile.motionScore > 0.08 && (
          <Badge variant="secondary">Movimento do transdutor</Badge>
        )}
      </div>
      <div className="col-span-2">
        <span className="text-muted-foreground">Camadas inferidas</span>
        <p className="font-medium">
          {profile.suggestedLayers.map((l) => l.name).join(' → ')}
        </p>
      </div>
    </div>
  );
}

export function UltrasoundVideoFeaturePanel({
  videoUrl,
}: UltrasoundVideoFeaturePanelProps) {
  const loadConfig = useUltrasoundLabStore((s) => s.loadConfig);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState<UltrasoundVideoProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isYouTube = Boolean(videoUrl && isYouTubeUrl(videoUrl));
  const canAnalyzeDirectUrl = Boolean(videoUrl && !isYouTube);

  const runExtraction = useCallback(async () => {
    if (!videoUrl || isYouTube) return;

    setIsAnalyzing(true);
    setProgress(0);
    setError(null);

    try {
      const result = await extractUltrasoundVideoProfileFromUrl(videoUrl, {
        maxFrames: 20,
        onProgress: setProgress,
      });
      setProfile(result);
      toast.success('Features extraídas do vídeo de referência');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha na análise do vídeo';
      setError(msg);
      toast.error('Análise falhou', { description: msg });
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoUrl, isYouTube]);

  const applyToLab = useCallback(() => {
    if (!profile) return;
    applyVideoProfileToLabStore(profile, loadConfig);
    toast.success('Parâmetros aplicados ao laboratório virtual', {
      description: `Transdutor ${TRANSDUCER_LABELS[profile.transducerType]}, ${profile.depthCm} cm, ganho ${profile.gain}`,
    });
  }, [profile, loadConfig]);

  if (!videoUrl) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Calibrar simulador a partir do vídeo
        </CardTitle>
        <CardDescription>
          Analisa clipes de ultrassom real (transdutor linear ou convexo) e extrai ganho,
          profundidade, speckle, sombras e camadas acústicas para montar o lab virtual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isYouTube && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Links do YouTube servem como referência visual no lab. A extração automática de
              parâmetros exige um link direto para arquivo de vídeo (legado).
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canAnalyzeDirectUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isAnalyzing}
              onClick={runExtraction}
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Analisar link do vídeo
            </Button>
          )}
          {profile && (
            <Button type="button" size="sm" onClick={applyToLab}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aplicar ao lab
            </Button>
          )}
        </div>

        {isAnalyzing && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Extraindo features dos frames…</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {profile && <ProfileSummary profile={profile} />}
      </CardContent>
    </Card>
  );
}
