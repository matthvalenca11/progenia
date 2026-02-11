# Mapeamento de Schema – possíveis incompatibilidades

Comparação entre o que o app usa e o que pode existir no banco de dados.

## Tabelas – nomes diferentes

| App usa | Schema antigo | Status |
|---------|---------------|--------|
| `capsula_progress` | `capsula_progresso_usuario` | ✅ Corrigido |
| `lesson_progress` | `user_progress` | ⚠️ Verificar |
| `quiz_questions` | `quiz_perguntas` | ⚠️ Verificar |
| `quiz_options` | `quiz_alternativas` | ⚠️ Verificar |
| `quiz_attempts` | `quiz_tentativas` | ⚠️ Verificar |

## Colunas – nomes diferentes

### capsulas
| App usa | Antigo |
|---------|--------|
| `module_id` | `modulo_id` |
| `order_index` | `ordem` |
| `title` | `titulo` |
| `is_published` | `ativo` ou `published` |

### modules
| App usa | Antigo |
|---------|--------|
| `is_published` | `published` |

### lessons
| App usa | Antigo |
|---------|--------|
| `module_id` | (pode ter) |
| `is_published` | `published` |

### user_stats
| App usa (Dashboard/Leaderboard) | App usa (Profile) | Antigo |
|---------------------------------|-------------------|--------|
| `total_lessons_completed` | `total_xp` | `total_xp`, `modules_completed`, `total_time_minutes` |
| `total_time_spent` | `modules_completed` | |
| `total_points` | `total_time_minutes` | |

O Profile ainda usa `total_xp`, `modules_completed`, `total_time_minutes`.  
Dashboard/Leaderboard usam `total_lessons_completed`, `total_time_spent`, `total_points`.  
`user_stats` precisa ter as colunas usadas pelo app.

### lesson_progress vs user_progress
| lesson_progress (app) | user_progress (antigo) |
|-----------------------|------------------------|
| `user_id`, `lesson_id`, `status`, `progress_percentage`, `data_conclusao` | `user_id`, `lesson_id`, `completed`, `time_spent_minutes`, `last_accessed_at`, `completed_at` |

## Como validar no seu Supabase

Execute no SQL Editor:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'lesson_progress', 'user_progress',
  'quiz_questions', 'quiz_perguntas',
  'quiz_options', 'quiz_alternativas',
  'quiz_attempts', 'quiz_tentativas'
)
ORDER BY table_name;
```

Isso mostra quais tabelas existem e ajuda a saber o que falta criar ou mapear.
