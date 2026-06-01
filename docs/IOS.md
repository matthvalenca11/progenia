# ProGenia — build iOS (Capacitor)

## Pré-requisitos

- macOS com **Xcode** instalado
- **Runtime do simulador iOS** instalado (Xcode → Settings → Components → iOS Simulator)
- CocoaPods (o `cap sync` roda `pod install` automaticamente)

## Comandos

```bash
# Build web + copiar para ios/ + pod install
npm run cap:sync:ios

# Abrir o projeto no Xcode
npm run cap:open:ios

# Build + sync + abrir Xcode (atalho)
npm run ios

# Build + sync + rodar no simulador (CLI)
npm run ios:run
```

## Fluxo no Xcode

1. Rode `npm run ios` (ou `npm run cap:open:ios` se já tiver feito sync).
2. No Xcode, escolha um simulador (ex.: iPhone 16) no seletor ao lado do scheme **App**.
3. Clique em **Run** (▶).

## Desenvolvimento web vs app nativo

- **Web:** rotas normais (`/dashboard`, `/auth`, …).
- **iOS/Android:** `HashRouter` automático (`/#/dashboard`) — necessário para o WebView do Capacitor.

## Variáveis de ambiente

As variáveis `VITE_*` do `.env` são embutidas no `npm run build`. Após alterar o `.env`, rode de novo:

```bash
npm run cap:sync:ios
```

## Problemas comuns

| Erro | Solução |
|------|---------|
| `iOS X.X is not installed` | Instale o runtime em Xcode → Settings → Components |
| Tela branca no app | Confirme `base: "./"` no `vite.config.ts` e rode sync de novo |
| Pods desatualizados | `cd ios/App && pod install` |
