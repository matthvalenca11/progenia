# AR Slice reference volumes

These bundled volumes are public anatomical visualization references. They are
not intended for clinical diagnosis. The MRI, CT, and PET templates come from
independent cohorts and must not be interpreted as voxelwise observations of
the same person.

## MRI — MNI152 T1

- File: `mni152_t1_2mm.nii`
- SHA-256: `ade9129bc1cef56e34ca57bf3699a48acf381071a1749a3a3994124b7a14cee6`
- Source and provenance: see `MNI152_SOURCE.md`.

## CT — Clinical Toolbox SCCT

- File: `clinical_scct_highres.nii`
- SHA-256: `0fbeedea171bcd61db6dea967a3d5cbaebce8f0b225274e074bce3547724ac9c`
- Source: https://github.com/neurolabusc/Clinical/blob/master/Tutorial/high_res/scct_unsmooth.nii
- Reference: Rorden C, Bonilha L, Fridriksson J, Bender B, Karnath HO.
  “Age-specific CT and MRI templates for spatial normalization.”
  NeuroImage 61(4), 2012.
- License: BSD 2-Clause.

Copyright (c) 2021, Chris Rorden

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS”
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

## PET — Brain Atlas FDG, MNI space

- File: `fdg_pet_mni_ctgrid.nii`
- SHA-256: `2925523a26ce5bb62ce5a36dae9fedd50136e157959793d1ea0102f16cae2222`
- Source volume:
  `FDG_MNISpace_EIR_5-6mm/Y40-50_SUVr_mni_atlas.nii.gz` from
  https://github.com/devhliu/BrainAtlas-FDG
- Transformation: cropped without interpolation from the source MNI extent
  (`193×229×193`, origin `-96,-132,-78`) to the exact Clinical CT grid
  (`181×217×181`, origin `-90,-125,-71`). Voxel size remains 1 mm isotropic.
- Reference: Wei YD, Zhang SX, Wen QX, Yin LJ, Yang S, Liu P, Zhou Z, Fu LP.
  “Generation of an Age-Dependent and Harmonized 18F-FDG Brain PET Atlas
  Using a High-Sensitivity Short-Axial FOV PET/CT System.” Human Brain
  Mapping 47(4), 2026.
- License: MIT.

Copyright (c) 2025 Liping Fu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
