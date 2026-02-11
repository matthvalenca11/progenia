#!/usr/bin/env node
/**
 * Script para verificar bugs e inconsistências nos labs virtuais
 * Verifica:
 * - Labs com lab_type incorreto
 * - Configs com estrutura errada
 * - Títulos/nomes inconsistentes com o tipo
 * - Labs sem config_data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
const envPath = join(__dirname, '..', '.env.local');
let env = {};
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.error('Erro ao ler .env.local:', e.message);
  process.exit(1);
}

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar em .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const issues = [];

console.log('🔍 Verificando labs virtuais...\n');

// Verificar labs no banco
const { data: labs, error } = await supabase
  .from('virtual_labs')
  .select('*')
  .order('created_at', { ascending: true });

if (error) {
  console.error('Erro ao buscar labs:', error);
  process.exit(1);
}

console.log(`📊 Total de labs encontrados: ${labs.length}\n`);

// Verificar cada lab
labs.forEach((lab, index) => {
  const labNum = index + 1;
  console.log(`\n${labNum}. ${lab.title || lab.name} (${lab.lab_type})`);
  
  // Verificar lab_type vs título/nome
  const titleLower = (lab.title || lab.name || '').toLowerCase();
  const nameLower = (lab.name || '').toLowerCase();
  
  // Verificar se é terapêutico mas tem nome/título de diagnóstico
  if (lab.lab_type === 'ultrasound_therapy' || lab.lab_type === 'ultrassom_terapeutico') {
    if (titleLower.includes('diagnóstico') || nameLower.includes('diagnóstico') || 
        titleLower.includes('diagnostico') || nameLower.includes('diagnostico') ||
        titleLower.includes('ganho') || titleLower.includes('frequência') ||
        titleLower.includes('carótida') || titleLower.includes('carotida')) {
      issues.push({
        lab: lab.title || lab.name,
        id: lab.id,
        type: 'INCONSISTÊNCIA',
        message: `Lab terapêutico com nome/título que sugere diagnóstico: "${lab.title || lab.name}"`,
        fix: 'Verificar se o lab_type está correto ou corrigir o título/nome'
      });
      console.log('  ⚠️  INCONSISTÊNCIA: Nome sugere diagnóstico mas lab_type é terapêutico');
    }
  }
  
  // Verificar se é diagnóstico mas tem nome/título de terapêutico
  if (lab.lab_type === 'ultrasound') {
    if (titleLower.includes('terapêutico') || nameLower.includes('terapêutico') ||
        titleLower.includes('terapeutico') || nameLower.includes('terapeutico') ||
        titleLower.includes('duty cycle') || titleLower.includes('continuidade') ||
        titleLower.includes('joelho') || titleLower.includes('antebraço') ||
        titleLower.includes('antebraco')) {
      issues.push({
        lab: lab.title || lab.name,
        id: lab.id,
        type: 'INCONSISTÊNCIA',
        message: `Lab diagnóstico com nome/título que sugere terapêutico: "${lab.title || lab.name}"`,
        fix: 'Verificar se o lab_type está correto ou corrigir o título/nome'
      });
      console.log('  ⚠️  INCONSISTÊNCIA: Nome sugere terapêutico mas lab_type é diagnóstico');
    }
  }
  
  // Verificar config_data
  if (!lab.config_data || Object.keys(lab.config_data).length === 0) {
    issues.push({
      lab: lab.title || lab.name,
      id: lab.id,
      type: 'CONFIG VAZIO',
      message: 'Lab sem config_data',
      fix: 'Adicionar configuração apropriada para o tipo de lab'
    });
    console.log('  ❌ CONFIG VAZIO');
  } else {
    const config = lab.config_data;
    
    // Verificar estrutura do config para terapêutico
    if (lab.lab_type === 'ultrasound_therapy' || lab.lab_type === 'ultrassom_terapeutico') {
      const expectedKeys = ['frequency', 'intensity', 'era', 'mode', 'dutyCycle', 'duration', 'scenario'];
      const hasDiagnosticKeys = config.gain !== undefined || config.depth !== undefined || 
                                config.layers !== undefined || config.acousticLayers !== undefined ||
                                config.inclusions !== undefined || config.presetId !== undefined;
      
      if (hasDiagnosticKeys) {
        issues.push({
          lab: lab.title || lab.name,
          id: lab.id,
          type: 'CONFIG ERRADO',
          message: 'Lab terapêutico com config_data de diagnóstico (tem gain, depth, layers, etc)',
          fix: 'Corrigir config_data para estrutura de ultrassom terapêutico'
        });
        console.log('  ❌ CONFIG ERRADO: Tem estrutura de diagnóstico');
      }
      
      const missingKeys = expectedKeys.filter(key => config[key] === undefined);
      if (missingKeys.length > 0) {
        issues.push({
          lab: lab.title || lab.name,
          id: lab.id,
          type: 'CONFIG INCOMPLETO',
          message: `Faltam campos: ${missingKeys.join(', ')}`,
          fix: 'Adicionar campos faltantes no config_data'
        });
        console.log(`  ⚠️  CONFIG INCOMPLETO: Faltam ${missingKeys.join(', ')}`);
      }
    }
    
    // Verificar estrutura do config para diagnóstico
    if (lab.lab_type === 'ultrasound') {
      const hasTherapyKeys = config.era !== undefined || config.mode === 'continuous' || 
                            config.mode === 'pulsed' || config.dutyCycle !== undefined ||
                            config.scenario !== undefined || config.coupling !== undefined;
      
      if (hasTherapyKeys && !config.gain && !config.depth && !config.layers) {
        issues.push({
          lab: lab.title || lab.name,
          id: lab.id,
          type: 'CONFIG ERRADO',
          message: 'Lab diagnóstico com config_data de terapêutico (tem era, mode, dutyCycle, etc)',
          fix: 'Corrigir config_data para estrutura de ultrassom diagnóstico'
        });
        console.log('  ❌ CONFIG ERRADO: Tem estrutura de terapêutico');
      }
    }
  }
  
  // Verificar slug
  if (!lab.slug) {
    issues.push({
      lab: lab.title || lab.name,
      id: lab.id,
      type: 'SLUG FALTANDO',
      message: 'Lab sem slug',
      fix: 'Gerar slug a partir do título'
    });
    console.log('  ⚠️  SEM SLUG');
  }
  
  // Verificar is_published
  if (lab.is_published && (!lab.config_data || Object.keys(lab.config_data).length === 0)) {
    issues.push({
      lab: lab.title || lab.name,
      id: lab.id,
      type: 'PUBLICADO SEM CONFIG',
      message: 'Lab publicado mas sem config_data',
      fix: 'Adicionar config_data ou despublicar'
    });
    console.log('  ⚠️  PUBLICADO SEM CONFIG');
  }
});

// Resumo
console.log('\n\n' + '='.repeat(80));
console.log('📋 RESUMO DE PROBLEMAS ENCONTRADOS');
console.log('='.repeat(80));

if (issues.length === 0) {
  console.log('\n✅ Nenhum problema encontrado!');
} else {
  console.log(`\n❌ Total de problemas: ${issues.length}\n`);
  
  const byType = {};
  issues.forEach(issue => {
    if (!byType[issue.type]) byType[issue.type] = [];
    byType[issue.type].push(issue);
  });
  
  Object.entries(byType).forEach(([type, items]) => {
    console.log(`\n${type} (${items.length}):`);
    items.forEach(item => {
      console.log(`  - ${item.lab} (ID: ${item.id})`);
      console.log(`    ${item.message}`);
      console.log(`    Fix: ${item.fix}`);
    });
  });
  
  // Gerar SQL de correção
  console.log('\n\n' + '='.repeat(80));
  console.log('🔧 SQL SUGERIDO PARA CORREÇÕES');
  console.log('='.repeat(80));
  
  const therapyWithDiagnosticConfig = issues.filter(i => 
    i.type === 'CONFIG ERRADO' && 
    (i.message.includes('terapêutico com config_data de diagnóstico') || 
     i.message.includes('diagnóstico com config_data de terapêutico'))
  );
  
  if (therapyWithDiagnosticConfig.length > 0) {
    console.log('\n-- Labs com config_data incorreto (verificar manualmente):');
    therapyWithDiagnosticConfig.forEach(item => {
      console.log(`-- ${item.lab} (${item.id})`);
      console.log(`-- SELECT id, title, lab_type, config_data FROM virtual_labs WHERE id = '${item.id}';`);
    });
  }
}

process.exit(issues.length > 0 ? 1 : 0);
