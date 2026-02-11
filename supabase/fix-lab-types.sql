-- Script para corrigir lab_type incorreto nos labs virtuais
-- Baseado em análise de título/nome e config_data

-- 1. Corrigir labs terapêuticos que estão marcados como diagnóstico
-- IDs específicos encontrados: a990ba21-d779-48ad-a93b-7ed59ce91876, 26d1081d-f7f3-44a7-aa1f-5c34031a8fe8
UPDATE virtual_labs
SET lab_type = 'ultrasound_therapy'
WHERE 
  (title ILIKE '%terapêutico%' OR title ILIKE '%terapeutico%' OR name ILIKE '%terapêutico%' OR name ILIKE '%terapeutico%')
  AND lab_type = 'ultrasound';

-- 2. Corrigir labs diagnóstico que estão marcados como terapêutico
UPDATE virtual_labs
SET lab_type = 'ultrasound'
WHERE 
  (title ILIKE '%diagnóstico%' OR title ILIKE '%diagnostico%' OR name ILIKE '%diagnóstico%' OR name ILIKE '%diagnostico%' 
   OR title ILIKE '%ganho%' OR title ILIKE '%frequência%' OR title ILIKE '%carótida%' OR title ILIKE '%carotida%')
  AND lab_type IN ('ultrasound_therapy', 'ultrassom_terapeutico')
  AND (config_data->>'gain' IS NOT NULL OR config_data->>'depth' IS NOT NULL OR config_data->>'layers' IS NOT NULL);

-- 3. Verificar resultados
SELECT 
  id,
  title,
  name,
  lab_type,
  slug,
  CASE 
    WHEN lab_type = 'ultrasound_therapy' AND (config_data->>'gain' IS NOT NULL OR config_data->>'depth' IS NOT NULL) THEN '⚠️ TERAPÊUTICO COM CONFIG DE DIAGNÓSTICO'
    WHEN lab_type = 'ultrasound' AND (config_data->>'era' IS NOT NULL OR config_data->>'dutyCycle' IS NOT NULL) THEN '⚠️ DIAGNÓSTICO COM CONFIG DE TERAPÊUTICO'
    ELSE '✅ OK'
  END as status
FROM virtual_labs
WHERE lab_type IN ('ultrasound', 'ultrasound_therapy', 'ultrassom_terapeutico')
ORDER BY created_at;
