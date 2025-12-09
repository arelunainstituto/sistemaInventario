-- Script para verificar e cadastrar funcionários faltantes
-- Execute este script no Supabase SQL Editor

-- Primeiro, vamos ver quais já estão cadastrados
SELECT 
    'JÁ CADASTRADOS:' as status,
    email,
    name
FROM rh_employees
WHERE email IN (
    'ana.moraes@institutoareluna.pt',
    'analyce.silva@institutoareluna.pt',
    'awais.bashir@institutoareluna.pt',
    'caroline.gomez@institutoareluna.pt',
    'cleiton.prata@institutoareluna.pt',
    'contasareceber@institutoareluna.pt',
    'danielly.motta@institutoareluna.pt',
    'diego.costa@institutoareluna.pt',
    'drsaraiva@institutoareluna.pt',
    'draarethuza@institutoareluna.pt',
    'eduardo.souza@institutoareluna.pt',
    'eliane.almeida@institutoareluna.pt',
    'elsa.brilhante@institutoareluna.pt',
    'erickson.carmo@pinklegion.com',
    'federica.laporta@institutoareluna.pt',
    'gabrielle.fernandez@institutoareluna.pt',
    'gisele.prudencio@institutoareluna.pt',
    'graziele.bassi@institutoareluna.pt',
    'helda.natal@institutoareluna.pt',
    'ian.thives@institutoareluna.pt',
    'igor.santos@institutoareluna.pt',
    'julia.cavazini@institutoareluna.pt',
    'julia.nara@institutoareluna.pt',
    'juliana.brito@institutoareluna.pt',
    'kenya.lampert@institutoareluna.pt',
    'leticia.bastos@institutoareluna.pt',
    'liana.hoeller@institutoareluna.pt',
    'lucilene.xavier@institutoareluna.pt',
    'maria.carolina@institutoareluna.pt',
    'maria.ferreira@institutoareluna.pt',
    'nelson.silva@institutoareluna.pt',
    'nicaela.cabral@institutoareluna.pt',
    'pedro.silva@pinklegion.com',
    'raphael.santana@institutoareluna.pt',
    'rebeca.alves@institutoareluna.pt',
    'roberta.justino@institutoareluna.pt',
    'sofia.falcato@institutoareluna.pt',
    'suzan.silva@institutoareluna.pt',
    'tais.souza@institutoareluna.pt',
    'talita.alves@institutoareluna.pt',
    'vinicius.novato@institutoareluna.pt',
    'wellen.novato@institutoareluna.pt',
    'zaira.barros@institutoareluna.pt'
)
ORDER BY name;

-- Ver quais NÃO estão cadastrados
SELECT 
    'FALTAM CADASTRAR:' as status,
    email_lista
FROM (
    VALUES 
        ('ana.moraes@institutoareluna.pt'),
        ('analyce.silva@institutoareluna.pt'),
        ('awais.bashir@institutoareluna.pt'),
        ('caroline.gomez@institutoareluna.pt'),
        ('cleiton.prata@institutoareluna.pt'),
        ('contasareceber@institutoareluna.pt'),
        ('danielly.motta@institutoareluna.pt'),
        ('diego.costa@institutoareluna.pt'),
        ('drsaraiva@institutoareluna.pt'),
        ('draarethuza@institutoareluna.pt'),
        ('eduardo.souza@institutoareluna.pt'),
        ('eliane.almeida@institutoareluna.pt'),
        ('elsa.brilhante@institutoareluna.pt'),
        ('erickson.carmo@pinklegion.com'),
        ('federica.laporta@institutoareluna.pt'),
        ('gabrielle.fernandez@institutoareluna.pt'),
        ('gisele.prudencio@institutoareluna.pt'),
        ('graziele.bassi@institutoareluna.pt'),
        ('helda.natal@institutoareluna.pt'),
        ('ian.thives@institutoareluna.pt'),
        ('igor.santos@institutoareluna.pt'),
        ('julia.cavazini@institutoareluna.pt'),
        ('julia.nara@institutoareluna.pt'),
        ('juliana.brito@institutoareluna.pt'),
        ('kenya.lampert@institutoareluna.pt'),
        ('leticia.bastos@institutoareluna.pt'),
        ('liana.hoeller@institutoareluna.pt'),
        ('lucilene.xavier@institutoareluna.pt'),
        ('maria.carolina@institutoareluna.pt'),
        ('maria.ferreira@institutoareluna.pt'),
        ('nelson.silva@institutoareluna.pt'),
        ('nicaela.cabral@institutoareluna.pt'),
        ('pedro.silva@pinklegion.com'),
        ('raphael.santana@institutoareluna.pt'),
        ('rebeca.alves@institutoareluna.pt'),
        ('roberta.justino@institutoareluna.pt'),
        ('sofia.falcato@institutoareluna.pt'),
        ('suzan.silva@institutoareluna.pt'),
        ('tais.souza@institutoareluna.pt'),
        ('talita.alves@institutoareluna.pt'),
        ('vinicius.novato@institutoareluna.pt'),
        ('wellen.novato@institutoareluna.pt'),
        ('zaira.barros@institutoareluna.pt')
) AS lista(email_lista)
WHERE email_lista NOT IN (
    SELECT email FROM rh_employees
);
