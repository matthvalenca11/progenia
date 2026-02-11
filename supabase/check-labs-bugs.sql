-- Script para verificar bugs nos labs virtuais
-- Verifica inconsistências entre lab_type e config_data

-- 1. Labs terapêuticos que podem ter config de diagnóstico
SELECT 
  id,
  title,
  name,
  lab_type,
  slug,
  CASE 
    WHEN config_data->>'gain' IS NOT NULL THEN 'TEM GAIN (diagnóstico!)'
    WHEN config_data->>'depth' IS NOT NULL THEN 'TEM DEPTH (diagnóstico!)'
    WHEN config_data->>'layers' IS NOT NULL THEN 'TEM LAYERS (diagnóstico!)'
    WHEN config_data->>'acousticLayers' IS NOT NULL THEN 'TEM ACOUSTICLAYERS (diagnóstico!)'
    WHEN config_data->>'presetId' IS NOT NULL THEN 'TEM PRESETID (diagnóstico!)'
    WHEN config_data->>'era' IS NOT NULL THEN 'TEM ERA (terapêutico)'
    WHEN config_data->>'dutyCycle' IS NOT NULL THEN 'TEM DUTYCYCLE (terapêutico)'
    WHEN config_data->>'scenario' IS NOT NULL THEN 'TEM SCENARIO (terapêutico)'
    ELSE 'SEM INDICADORES CLAROS'
  END as config_type,
  jsonb_object_keys(config_data) as config_keys
FROM virtual_labs
WHERE lab_type IN ('ultrasound_therapy', 'ultrassom_terapeutico')
ORDER BY created_at;

-- 2. Labs diagnóstico que podem ter config de terapêutico
SELECT 
  id,
  title,
  name,
  lab_type,
  slug,
  CASE 
    WHEN config_data->>'gain' IS NOT NULL THEN 'TEM GAIN (diagnóstico)'
    WHEN config_data->>'depth' IS NOT NULL THEN 'TEM DEPTH (diagnóstico)'
    WHEN config_data->>'layers' IS NOT NULL THEN 'TEM LAYERS (diagnóstico)'
    WHEN config_data->>'era' IS NOT NULL THEN 'TEM ERA (terapêutico!)'
    WHEN config_data->>'dutyCycle' IS NOT NULL THEN 'TEM DUTYCYCLE (terapêutico!)'
    WHEN config_data->>'scenario' IS NOT NULL THEN 'TEM SCENARIO (terapêutico!)'
    ELSE 'SEM INDICADORES CLAROS'
  END as config_type
FROM virtual_labs
WHERE lab_type = 'ultrasound'
ORDER BY created_at;

-- 3. Verificar se há labs com lab_type NULL ou vazio
SELECT 
  id,
  title,
  name,
  lab_type,
  slug,
  is_published
FROM virtual_labs
WHERE lab_type IS NULL OR lab_type = ''
ORDER BY created_at;

-- 4. Verificar labs com títulos/nomes inconsistentes
SELECT 
  id,
  title,
  name,
  lab_type,
  slug,
  CASE 
    WHEN (title ILIKE '%terapêutico%' OR title ILIKE '%terapeutico%' OR name ILIKE '%terapêutico%' OR name ILIKE '%terapeutico%') 
         AND lab_type = 'ultrasound' THEN 'NOME TERAPÊUTICO MAS TIPO DIAGNÓSTICO'
    WHEN (title ILIKE '%diagnóstico%' OR title ILIKE '%diagnostico%' OR name ILIKE '%diagnóstico%' OR name ILIKE '%diagnostico%' OR title ILIKE '%ganho%' OR title ILIKE '%frequência%' OR title ILIKE '%carótida%')
         AND lab_type IN ('ultrasound_therapy', 'ultrassom_terapeutico') THEN 'NOME DIAGNÓSTICO MAS TIPO TERAPÊUTICO'
    ELSE 'OK'
  END as inconsistency
FROM virtual_labs
WHERE 
  (title ILIKE '%terapêutico%' OR title ILIKE '%terapeutico%' OR name ILIKE '%terapêutico%' OR name ILIKE '%terapeutico%' OR
   title ILIKE '%diagnóstico%' OR title ILIKE '%diagnostico%' OR name ILIKE '%diagnóstico%' OR name ILIKE '%diagnostico%')
ORDER BY created_at;
