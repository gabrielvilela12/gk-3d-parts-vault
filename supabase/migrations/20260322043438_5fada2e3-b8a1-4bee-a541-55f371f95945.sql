
-- Mover todos os anjos para Religioso
UPDATE pieces SET category = 'Religioso' WHERE (name ILIKE '%anjo%' OR name ILIKE '%angel%' OR name ILIKE '%anjinho%') AND category != 'Religioso';

-- Quadro Jesus → Religioso
UPDATE pieces SET category = 'Religioso' WHERE name ILIKE '%jesus%' AND category != 'Natal';

-- Presépio Iluminado → Religioso (não é específico de Natal)
UPDATE pieces SET category = 'Religioso' WHERE name = 'Presépio Iluminado';

-- Corrigir Cubo Infinito → Esculturas (entrou errado em Religioso)
UPDATE pieces SET category = 'Esculturas' WHERE name ILIKE '%cubo infinito%';

-- Corrigir Fruteira → Utilidades (entrou errado em Religioso)
UPDATE pieces SET category = 'Utilidades' WHERE name ILIKE '%fruteira%';

-- Corrigir "anjo de fada" → Religioso (já está, mas garantir)
UPDATE pieces SET category = 'Religioso' WHERE name ILIKE '%anjo de fada%';
