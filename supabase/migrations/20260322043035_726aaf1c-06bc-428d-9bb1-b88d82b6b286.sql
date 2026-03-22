
-- Categorizar peças de PÁSCOA
UPDATE pieces SET category = 'Páscoa', stores = ARRAY['Loja 2'] WHERE name ILIKE '%páscoa%' OR name ILIKE '%pascoa%' OR name ILIKE '%coelh%' OR name ILIKE '%easter%' OR name ILIKE '%ovo de páscoa%';

-- Categorizar peças de NATAL  
UPDATE pieces SET category = 'Natal' WHERE (name ILIKE '%natal%' OR name ILIKE '%neve%' OR name ILIKE '%rena%' OR name ILIKE '%presépio%' OR name ILIKE '%hohoho%' OR name ILIKE '%trenó%' OR name ILIKE '%pinheirinho%' OR name ILIKE '%floco%' OR name ILIKE '%bolas de arvore%') AND category IS DISTINCT FROM 'Páscoa';

-- Categorizar ANJOS / Religioso
UPDATE pieces SET category = 'Religioso' WHERE (name ILIKE '%anjo%' OR name ILIKE '%angel%' OR name ILIKE '%oração%' OR name ILIKE '%jesus%' OR name ILIKE '%guarda%') AND category NOT IN ('Páscoa', 'Natal');

-- Categorizar VASOS
UPDATE pieces SET category = 'Vasos' WHERE (name ILIKE '%vaso%' OR name ILIKE '%ikea fejka%') AND category IS NULL;

-- Categorizar ESCULTURAS / Decoração artística
UPDATE pieces SET category = 'Esculturas' WHERE (name ILIKE '%escultura%' OR name ILIKE '%estátua%' OR name ILIKE '%busto%' OR name ILIKE '%abstrat%' OR name ILIKE '%pensador%' OR name ILIKE '%pantera%' OR name ILIKE '%leão%' OR name ILIKE '%xadrez%' OR name ILIKE '%gato%' OR name ILIKE '%elefante%' OR name ILIKE '%pássaro%' OR name ILIKE '%coruja%') AND category IS NULL;

-- Categorizar UTILIDADES / Organizadores
UPDATE pieces SET category = 'Utilidades' WHERE (name ILIKE '%organizador%' OR name ILIKE '%suporte%' OR name ILIKE '%porta %' OR name ILIKE '%gancho%' OR name ILIKE '%limpador%' OR name ILIKE '%saboneteira%' OR name ILIKE '%fruteira%' OR name ILIKE '%tampa%' OR name ILIKE '%válvula%' OR name ILIKE '%nametag%' OR name ILIKE '%identificador%' OR name ILIKE '%medidor%' OR name ILIKE '%notebook%' OR name ILIKE '%laptop%' OR name ILIKE '%headset%' OR name ILIKE '%cabo%' OR name ILIKE '%filtro%' OR name ILIKE '%placa%' OR name ILIKE '%escova%') AND category IS NULL;

-- Categorizar LETREIROS / Decoração com palavras
UPDATE pieces SET category = 'Letreiros' WHERE (name ILIKE '%letreiro%' OR name ILIKE '%love%' OR name ILIKE '%gratidão%' OR name ILIKE '%home%' OR name ILIKE '%quadro%' OR name ILIKE '%foto%') AND category IS NULL;

-- Categorizar TEMÁTICOS
UPDATE pieces SET category = 'Temáticos' WHERE (name ILIKE '%stranger%' OR name ILIKE '%vecna%' OR name ILIKE '%mickey%') AND category IS NULL;

-- O resto que sobrou vai para Decoração
UPDATE pieces SET category = 'Decoração' WHERE category IS NULL;

-- Colocar itens de Páscoa na Loja 2
UPDATE pieces SET stores = ARRAY['Loja 2'] WHERE category = 'Páscoa';
