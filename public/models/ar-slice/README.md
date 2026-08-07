# AR Slice — volume de ressonância

O lab AR Slice usa o **mesmo T1 clínico** do laboratório de Ressonância Magnética (caso BraTS 001).

## Onde colocar o arquivo

Copie para **uma** destas pastas:

1. `public/assets/cases/001/BraTS20_Training_001_t1.nii` (preferido — compartilhado com o lab MRI)
2. `public/models/ar-slice/brain_t1.nii` (cópia dedicada ao AR Slice)

O arquivo **não** vai no Git (tamanho/licença). Use o mesmo NIfTI que já funciona no lab **Ressonância Magnética → case01_brain_normal**.

## O que o app faz

- **Superfície 3D**: iso-surface do T1 (marching cubes), cortada pelo plano da moldura
- **Fatia no plano**: textura gerada em tempo real a partir do volume (window/level clínico)
- **Fallback**: se o NIfTI não existir, mostra a cabeça procedural verde

## GLB opcional

`head.glb` continua opcional; o fluxo principal é NIfTI T1.
