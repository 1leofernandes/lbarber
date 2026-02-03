# Ajustes de Assinatura e Cálculo de Valor de Agendamento

## Data da Implementação
3 de fevereiro de 2026

## Resumo das Alterações

Este documento descreve todas as mudanças implementadas para suportar o cálculo de `valor_total` em agendamentos considerando assinaturas de usuários e dias de cobertura.

### Objetivo
- Implementar cálculo automático de `valor_total` para agendamentos considerando:
  - Se o usuário é assinante (`usuarios.assinante = true`) e possui `assinatura_id`
  - Serviços contemplados na assinatura (tabela `assinatura_servico`)
  - Dias válidos da assinatura (tabela `assinatura_dias_semana`, comparando com dia da data do agendamento via `EXTRACT(ISODOW FROM data)`)
  - Para agendamentos com múltiplos serviços, somente os serviços cobertos são zerados
- Implementar endpoints que retornam `precoEstimado` e `precoComDesconto` para o cliente
- Exibir `valor_total` nas páginas admin e cliente
- Vincular automaticamente `assinatura_usuario_id` ao criar agendamento se aplicável

## Alterações por Arquivo

### 1. src/models/Appointment.js
**Mudanças:**
- `findAll()`: Adicionado cálculo de `valor_total` usando subquery que verifica assinatura e dias
- `findByIdWithServices()`: Adicionado cálculo de `valor_total` com lógica de desconto
- `findByUserWithServices()`: Adicionado cálculo de `valor_total` com lógica de desconto
- `createWithServices()`: Agora preenche `assinatura_usuario_id` automaticamente se usuário possuir assinatura ativa e válida para a data

**Query de Cálculo do `valor_total`:**
```sql
COALESCE((
  SELECT COALESCE(SUM(
    CASE
      WHEN u2.assinante = true
        AND u2.assinatura_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM assinatura_servico ass 
          WHERE ass.assinatura_id = u2.assinatura_id AND ass.servico_id = s2.id
        )
        AND EXISTS (
          SELECT 1 FROM assinatura_dias_semana ads 
          WHERE ads.assinatura_id = u2.assinatura_id 
            AND ads.dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::integer
        )
      THEN 0
      ELSE COALESCE(s2.valor_servico, 0)
    END
  ),0)
  FROM (
    SELECT servico_id FROM agendamento_servicos WHERE agendamento_id = a.id
    UNION ALL
    SELECT a.servico_id WHERE a.servico_id IS NOT NULL 
      AND NOT EXISTS (SELECT 1 FROM agendamento_servicos WHERE agendamento_id = a.id)
  ) rel
  LEFT JOIN servicos s2 ON rel.servico_id = s2.id
  LEFT JOIN usuarios u2 ON u2.id = a.usuario_id
), 0) as valor_total
```

**Lógica:**
1. Para cada serviço no agendamento:
   - Se usuário é assinante (`u2.assinante = true`)
   - E possui assinatura (`u2.assinatura_id IS NOT NULL`)
   - E serviço está incluso na assinatura (`EXISTS em assinatura_servico`)
   - E dia do agendamento está coberto pela assinatura (`EXISTS em assinatura_dias_semana` com `EXTRACT(ISODOW)`)
   - Então: valor = 0
   - Senão: valor = valor_servico

### 2. src/services/agendamentoService.js
**Mudanças:**
- `getHorariosDisponiveis()`: Agora retorna objeto com:
  - `horarios`: array de horários disponíveis
  - `precoEstimado`: soma dos valores dos serviços sem desconto
  - `precoComDesconto`: valor final considerando assinatura e dias cobertos (se usuário identificado)
  
**Cálculo de Preços:**
```javascript
if (usuarioId) {
  // Buscar dados do usuário
  const user = await pool.query('SELECT assinante, assinatura_id FROM usuarios WHERE id = $1', [usuarioId]);
  if (user.assinante && user.assinatura_id) {
    // Identificar dia da semana (ISODOW: 1=segunda, 7=domingo)
    const diaSemana = EXTRACT(ISODOW FROM data)::integer;
    // Buscar serviços cobertos pelo plano
    const coveredIds = await pool.query(
      'SELECT servico_id FROM assinatura_servico WHERE assinatura_id = $1 AND servico_id = ANY($2::int[])',
      [assinatura_id, servicosIds]
    );
    // Verificar se dia está coberto
    const diaCoberto = await pool.query(
      'SELECT 1 FROM assinatura_dias_semana WHERE assinatura_id = $1 AND dia_semana = $2',
      [assinatura_id, diaSemana]
    );
    // Aplicar desconto: se serviço coberto e dia coberto => valor 0, senão soma normal
  }
}
```

### 3. src/services/admin/agendamentoService.js
**Mudanças:**
- `getResumoAgendamentos()`: Agora calcula receita considerando assinaturas e dias cobertos, usando mesma lógica de `valor_total`

### 4. src/controllers/agendamentoController.js
**Mudanças:**
- `getHorariosDisponiveis()`: Retorna novo formato com `data: { horarios, precoEstimado, precoComDesconto }`
- Passa `userId` para o service para cálculo de desconto

### 5. public/agendamento.html
**Mudanças (JavaScript):**
- Nova função `buscarHorarios()` que consome endpoint e atualiza elementos:
  - `.summary-price-estimated`: exibe `precoEstimado`
  - `.summary-price-final`: exibe `precoComDesconto`
- Mostra desconto em tempo real antes de confirmar agendamento

### 6. public/cliente-home.html
**Mudanças (JavaScript):**
- Ao renderizar lista de agendamentos, prefere `agendamento.valor_total` quando disponível
- Fallback para cálculo local se `valor_total` não retornar do servidor

### 7. public/admin.html
**Mudanças (JavaScript):**
- Ao renderizar tabela de agendamentos, exibe `agendamento.valor_total` quando disponível
- Fallback para cálculo local se necessário

## Fluxo de Funcionamento

### 1. Cliente Assinante Agendar Serviço
```
Usuario (assinante=true, assinatura_id=1) 
  => Agendar Corte (incluído em assinatura 1, dias 1-3)
    => Data = segunda-feira (dia 1)
      => SQL calcula: 
         - Serviço "Corte" está em assinatura_servico(assinatura_id=1, servico_id=1)?
         - Dia 1 está em assinatura_dias_semana(assinatura_id=1, dia_semana=1)?
         - Ambas SIM => valor_total = 0 ✓
```

### 2. Cliente Assinante Agendar Múltiplos Serviços (um incluso, outro não)
```
Usuario (assinante=true, assinatura_id=1)
  => Agendar Corte (R$40, incluído) + Barba (R$30, NÃO incluído)
    => Data = segunda-feira (dia 1)
      => SQL calcula:
         - Corte: assinante + incluído + dia coberto => 0
         - Barba: assinante + NÃO incluído => R$30
         - valor_total = 0 + 30 = R$30 ✓
```

### 3. Cliente Assinante Agendar em Dia Não Coberto
```
Usuario (assinante=true, assinatura_id=1)
  => Agendar Corte (incluído, mas dias=1-3 apenas)
    => Data = quinta-feira (dia 4)
      => SQL calcula:
         - Dia 4 NÃO está em assinatura_dias_semana => não aplica desconto
         - valor_total = R$40 ✓
```

### 4. Cliente Não Assinante
```
Usuario (assinante=false)
  => Agendar qualquer serviço
    => valor_total = soma normal dos serviços (sem desconto) ✓
```

## Criação de Asssinatura para Testes

Para testar o sistema, execute no banco de dados:

```sql
-- 1. Criar plano "Corte Ilimitado"
INSERT INTO assinatura (valor, nome_plano, descricao, status) 
VALUES (99.90, 'Corte Ilimitado', 'Cortes ilimitados segunda a quarta', 'ativo') 
RETURNING id;
-- Guarde o ID (ex: 1)

-- 2. Criar serviço "Corte"
INSERT INTO servicos (nome_servico, duracao_servico, valor_servico) 
VALUES ('Corte de Cabelo', 30, 40.00) 
RETURNING id;
-- Guarde o ID (ex: 1)

-- 3. Associar serviço ao plano
INSERT INTO assinatura_servico (assinatura_id, servico_id) 
VALUES (1, 1); -- Corte Ilimitado cobre Corte de Cabelo

-- 4. Associar dias de cobertura (segunda=1, terça=2, quarta=3)
INSERT INTO assinatura_dias_semana (assinatura_id, dia_semana) VALUES (1, 1);
INSERT INTO assinatura_dias_semana (assinatura_id, dia_semana) VALUES (1, 2);
INSERT INTO assinatura_dias_semana (assinatura_id, dia_semana) VALUES (1, 3);

-- 5. Criar usuário assinante (ou atualizar existente)
-- Opção A: Criar novo
INSERT INTO usuarios (nome, email, senha, assinante, assinatura_id) 
VALUES ('João Assinante', 'joao@example.com', '...', true, 1);

-- Opção B: Atualizar existente
UPDATE usuarios SET assinante = true, assinatura_id = 1 WHERE id = 2;

-- 6. Criar registro em assinaturas_usuarios (assinatura ativa)
INSERT INTO assinaturas_usuarios (usuario_id, plano_id, status, data_inicio) 
VALUES (2, 1, 'ativa', CURRENT_DATE);
```

## Testes Recomendados

### Teste 1: Agendamento com Desconto (Dia Coberto)
1. Cliente assinante acessa página de agendamento
2. Seleciona barbeiro, serviço "Corte", data de segunda-feira
3. Sistema mostra:
   - Preço original: R$ 40.00
   - Preço com desconto: R$ 0.00 (porque serviço incluso na assinatura e dia coberto)
4. Confirma agendamento
5. Verifica em "Meus Agendamentos": valor_total = R$ 0.00 ✓

### Teste 2: Agendamento com Desconto Parcial (Múltiplos Serviços)
1. Cliente assinante acessa página de agendamento
2. Seleciona: Corte (R$40, incluso) + Barba (R$30, não incluso), segunda-feira
3. Sistema mostra:
   - Preço original: R$ 70.00
   - Preço com desconto: R$ 30.00 (desconto aplicado só no Corte)
4. Confirma agendamento
5. Verifica em "Meus Agendamentos": valor_total = R$ 30.00 ✓

### Teste 3: Agendamento Sem Desconto (Dia Não Coberto)
1. Cliente assinante acessa página de agendamento
2. Seleciona Corte, quinta-feira (dia não coberto)
3. Sistema mostra:
   - Preço original: R$ 40.00
   - Preço com desconto: R$ 40.00 (sem desconto, dia não coberto)
4. Confirma agendamento
5. Verifica em "Meus Agendamentos": valor_total = R$ 40.00 ✓

### Teste 4: Admin Verifica Receita
1. Admin acessa relatório de receita
2. Verifica período que contém:
   - Agendamento sem desconto (R$ 40)
   - Agendamento com desconto (R$ 0)
   - Agendamento com desconto parcial (R$ 30)
3. Receita total para o dia = R$ 70.00 ✓

### Teste 5: Cliente Não Assinante
1. Cliente não assinante acessa página de agendamento
2. Seleciona qualquer serviço e data
3. Sistema mostra:
   - Preço sem desconto (preço original = preço com desconto)
4. Confirma agendamento
5. Verifica em "Meus Agendamentos": valor_total = valor original ✓

## Notas Técnicas

### Sobre EXTRACT(ISODOW)
- `EXTRACT(ISODOW FROM data)` retorna:
  - 1 = Segunda-feira
  - 2 = Terça-feira
  - 3 = Quarta-feira
  - 4 = Quinta-feira
  - 5 = Sexta-feira
  - 6 = Sábado
  - 7 = Domingo
- Compatível com valor salvo em `assinatura_dias_semana.dia_semana`

### Sobre Compatibilidade
- Agendamentos criados com `create()` (método antigo) continuam funcionando
- Novos agendamentos via `createWithServices()` têm suporte completo
- Se `agendamento_servicos` estiver vazio, usa `agendamento.servico_id` como fallback

### Performance
- Queries otimizadas com índices existentes
- Cálculo de `valor_total` feito no DB (SQL), não na aplicação
- Sem N+1 queries: agregação com `json_agg` em uma única query

## Possíveis Melhorias Futuras

1. **Histórico de Preços**: Registrar valor_final quando agendamento é confirmado (para auditoria)
2. **Dashboard de Receita**: Gráfico de receita vs. receita com assinantes
3. **Notificações**: Alertar admin quando muitos desconto são aplicados (tendência de crescimento em assinantes)
4. **Política de Cancelamento**: Aplicar desconto proporcional se cliente cancelar agendamento assinante
5. **Limite de Agendamentos**: Controlar quantos agendamentos assinante pode fazer por semana/mês

## Troubleshooting

### Problema: `valor_total` retorna `null`
**Solução**: Verificar se query foi executada corretamente; tentar `COALESCE(..., 0)` foi adicionado, então deve retornar 0 no mínimo.

### Problema: Desconto não está sendo aplicado
**Solução**: Verificar:
1. `usuarios.assinante = true`?
2. `usuarios.assinatura_id` preenchido?
3. Serviço existe em `assinatura_servico`?
4. Dia do agendamento existe em `assinatura_dias_semana` com valor correto (1-3 para seg-qua)?

### Problema: API retorna erro ao buscar horários
**Solução**: Verificar se:
1. `userId` foi passado corretamente ao service
2. Query de assinatura está buscando corretamente em `assinaturas_usuarios` com status='ativa'

## Commits Relacionados

Este documento resume as alterações feitas em um único commit:
```
feat: ajustar cálculo de assinaturas e valor_total de agendamentos
```

Arquivos modificados:
- `src/models/Appointment.js`
- `src/services/agendamentoService.js`
- `src/services/admin/agendamentoService.js`
- `src/controllers/agendamentoController.js`
- `public/agendamento.html` (JS)
- `public/cliente-home.html` (JS)
- `public/admin.html` (JS)
- `docs/AJUSTES_ASSINATURA_AGENDAMENTOS.md` (este arquivo)

## Dúvidas ou Problemas?

Consulte este arquivo e execute os testes recomendados. Se o problema persistir, verifique:
1. Logs do servidor (`console.error` em service/controller)
2. Queries SQL diretamente no banco
3. Estado dos dados de assinatura/usuário
