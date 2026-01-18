// ARQUITETURA DE AGENDAMENTOS - BARBEARIA
// ============================================

## 1. POR QUE USAR hora_inicio E hora_fim?

### Comparação entre abordagens:

| Abordagem                      | Vantagem                         | Desvantagem                      |
| ------------------------------ | -------------------------------- | -------------------------------- |
| **hora_agendada** (uma coluna) | Simples, pouco espaço            | Não suporta durações variáveis   |
| **hora_agendada + calcular**   | Calcula dinamicamente            | Requer lógica complexa no código |
| **hora_inicio + hora_fim** ✅  | **Flexível, rápido, armazenado** | Duas colunas (trade-off pequeno) |

### Sua barbearia vai crescer com:

- ✅ Corte (30 min) + Barba (30 min) + Tingimento (20 min) = 80 minutos?
- ✅ Alguns clientes podem precisar 90 minutos?
- ✅ Você pode pausar 15 minutos entre clientes?

**Com hora_inicio/hora_fim, tudo é simples de implementar.**

---

## 2. FLUXO COMPLETO DE AGENDAMENTO

### Passo 1: Frontend - Listar Barbeiros

```
GET /barbeiros
Response: [
  { id: 1, nome: "João", },
  { id: 2, nome: "Pedro", }
]
```

### Passo 2: Frontend - Selecionar Serviço

```
GET /servicos
Response: [
  { id: 2, nome_servico: "Corte + Barba", duracao_servico: 60, valor_servico: 45 },
  { id: 3, nome_servico: "Corte", duracao_servico: 30, valor_servico: 25 }
]
```

### Passo 3: Frontend - Selecionar Data

```
(user picks 2024-01-15)
```

### Passo 4: Backend - Calcular Horários Disponíveis

```
GET /agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15&servico_id=2

Lógica:
1. Buscar duracao_servico = 60 minutos
2. Query horários bloqueados (agendamentos + bloqueios do dia)
3. Gerar slots: 08:00, 08:30, 09:00, 09:30, 10:00, ...
4. Para cada slot, verificar: cabe 60 minutos sem conflitos?
5. Retornar apenas os que cabem
```

### Passo 5: Backend - Criar Agendamento

```
POST /agendamentos
Body: {
  barbeiro_id: 1,
  servico_id: 2,
  data_agendada: "2024-01-15",
  hora_inicio: "10:00"
}

Backend:
1. Calcula hora_fim = 10:00 + 60min = 11:00
2. Verifica conflitos: existe agendamento em 10:00-11:00?
3. Se OK, insere:
   {
     usuario_id: 123 (do token),
     barbeiro_id: 1,
     servico_id: 2,
     data_agendada: "2024-01-15",
     hora_inicio: "10:00",
     hora_fim: "11:00",
     status: "confirmado"
   }
```

---

## 3. QUERIES OTIMIZADAS

### Verificar Disponibilidade

```sql
-- Dois clientes podem agendar 10:00 se não houver conflito
-- Range overlap: hora_inicio < FIM_DESEJADA AND hora_fim > INICIO_DESEJADA

SELECT COUNT(*) FROM agendamentos
WHERE barbeiro_id = 1
  AND data_agendada = '2024-01-15'
  AND hora_inicio < '11:00'      -- hora_fim desejada
  AND hora_fim > '10:00'         -- hora_inicio desejada
  AND status != 'cancelado';

-- Resultado: 0 = disponível, >0 = bloqueado
```

### Listar Indisponibilidades do Dia

```sql
-- Combina agendamentos confirmados + bloqueios manuais
SELECT hora_inicio, hora_fim, 'agendamento' as tipo
FROM agendamentos
WHERE barbeiro_id = 1
  AND data_agendada = '2024-01-15'
  AND status != 'cancelado'

UNION ALL

SELECT hora_inicio, hora_fim, 'bloqueio' as tipo
FROM bloqueios
WHERE id_barbeiro = 1
  AND data = '2024-01-15'

ORDER BY hora_inicio;

-- Resultado:
-- 09:00 - 09:30 (agendamento - Corte)
-- 09:30 - 10:15 (agendamento - Barba)
-- 13:00 - 14:00 (bloqueio - Almoço)
```

### Agenda Completa do Barbeiro

```sql
SELECT
  a.id,
  a.data_agendada,
  a.hora_inicio,
  a.hora_fim,
  u.nome AS cliente,
  s.nome_servico,
  a.status
FROM agendamentos a
INNER JOIN usuarios u ON a.usuario_id = u.id
INNER JOIN servicos s ON a.servico_id = s.id
WHERE a.barbeiro_id = 1
  AND a.data_agendada >= CURRENT_DATE
ORDER BY a.data_agendada, a.hora_inicio;

-- Resultado:
-- ID | Data | Inicio | Fim | Cliente | Serviço | Status
-- 101 | 2024-01-15 | 09:00 | 09:30 | Carlos | Corte | confirmado
-- 102 | 2024-01-15 | 09:30 | 10:15 | Ana | Barba | confirmado
```

---

## 4. TRATAMENTO DE ERROS

```javascript
// Cenário: Cliente tenta agendar 10:00, mas há conflito em 10:15-10:45

// Backend detecta:
- Slot desejado: 10:00 - 11:00 (60 min, serviço "Corte + Barba")
- Agendamento existente: 10:15 - 10:45
- Overlap? 10:00 < 10:45 AND 11:00 > 10:15 = TRUE ❌

Response 409 Conflict:
{
  success: false,
  message: "Horário indisponível para este barbeiro",
  conflitoCom: {
    inicio: "10:15",
    fim: "10:45",
    cliente: "Ana",
    servico: "Barba"
  }
}
```

---

## 5. CASOS DE USO AVANÇADOS

### Caso 1: Múltiplos Serviços (Futura Expansão)

```
POST /agendamentos
Body: {
  barbeiro_id: 1,
  servicos: [2, 3],  // Corte (30min) + Barba (30min)
  data_agendada: "2024-01-15",
  hora_inicio: "10:00"
}

Backend calcula:
- duracao_total = 30 + 30 = 60 minutos
- hora_fim = 10:00 + 60 = 11:00
- Bloqueia 10:00-11:00 para esta combinação
```

### Caso 2: Buffer Time Entre Clientes (Limpeza)

```
// Seu barbeiro gostaria de 10 minutos entre agendamentos

POST /agendamentos com hora_inicio = 10:00
- Agendamento: 10:00 - 11:00
- Bloqueio automático: 11:00 - 11:10 (buffer via trigger ou app logic)

Próximo cliente pode agendar a partir de 11:10
```

### Caso 3: Férias/Dias de Folga

```
// João não trabalha 01-15 de janeiro

POST /bloqueios
Body: {
  id_barbeiro: 1,
  data: "2024-01-01",
  hora_inicio: "00:00",
  hora_fim: "23:59",  // Bloqueia todo o dia
  descricao: "Férias"
}

GET /agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-01
Response: { horariosDisponiveis: [] }  // Nenhum horário disponível
```

---

## 6. PERFORMANCE

### Índices Essenciais

```sql
-- Busca mais comum: horários de um barbeiro em um dia
CREATE INDEX idx_agendamentos_barbeiro_data
ON agendamentos(barbeiro_id, data_agendada);

-- Busca de overlap
CREATE INDEX idx_agendamentos_intervalo
ON agendamentos(barbeiro_id, data_agendada, hora_inicio, hora_fim);
```

### Tempos de Query (Estimado)

```
- Verificar conflito: ~1ms (com índices)
- Listar horários indisponíveis: ~5ms
- Listar agenda completa: ~10ms
- Criar agendamento: ~2ms
```

---

## 7. SEGURANÇA & VALIDAÇÕES

### No Backend:

```javascript
✅ hora_fim > hora_inicio (constraint SQL)
✅ data_agendada >= hoje (constraint SQL)
✅ barbeiro_id != usuario_id (não pode agendar consigo)
✅ Verificar autorização (cliente só vê seus agendamentos)
✅ Barbeiro não pode agendar para si (validação)
✅ Não permitir horas inválidas (fora do funcionamento)
```

### No Frontend:

```javascript
✅ Data picker: desabilitar datas passadas
✅ Horário picker: desabilitar slots já mostrados como indisponíveis
✅ Mostrar duração visual: "10:00 - 11:00 (60 minutos)"
✅ Confirmação: "Confirma corte de 1 hora para 10:00?"
```

---

## 8. ROADMAP FUTURO

### Fase 2: Notificações

- SMS/Email 24h antes
- Cancelamento via link

### Fase 3: Rescheduling

- Cliente pede reagendamento
- Sistema oferece próximos horários

### Fase 4: Avaliações

- Cliente avalia barbeiro
- Histórico de serviços

### Fase 5: Multi-Barber Sync

- 2+ barbeiros trabalhando
- Reserva de insumos (tintura, etc)

---

## 9. IMPLEMENTAÇÃO IMEDIATA

### Seu To-Do:

```sql
-- 1. Executar agendamentos-schema.sql
-- 2. Verificar estrutura:
SELECT * FROM agendamentos LIMIT 0;  -- Verifica colunas

-- 3. Testar inserção:
INSERT INTO agendamentos (usuario_id, barbeiro_id, servico_id, data_agendada, hora_inicio, hora_fim)
VALUES (1, 2, 1, '2024-01-15', '10:00', '11:00');

-- 4. Testar query de conflito:
SELECT COUNT(*) FROM agendamentos
WHERE barbeiro_id = 2
  AND data_agendada = '2024-01-15'
  AND hora_inicio < '11:00'
  AND hora_fim > '10:00';
-- Deve retornar 1
```

---

## 10. RESPOSTA: "QUAL É O MELHOR CAMINHO?"

### ✅ RECOMENDAÇÃO FINAL:

**Use `hora_inicio` + `hora_fim` porque:**

1. **Profissionalismo**: Matches industry standard (Google Calendar, Calendly, etc)
2. **Escalabilidade**: Suporta durações variáveis sem alteração de schema
3. **Performance**: Queries rápidas com índices apropriados
4. **Simplicidade**: Uma linha em SQL detecta conflitos (range overlap)
5. **Flexibilidade**: Preparado para múltiplos barbeiros, pausas, férias
6. **Futura expansão**: Quando adicionar múltiplos serviços, está pronto

### Implementação atual (✅ Pronta):

- [x] Tabela schema definida
- [x] Lógica de cálculo em Appointment.js
- [x] Query de conflito otimizada
- [x] Slots gerados com duração
- [x] Indices para performance

### Próximos passos:

```bash
# 1. Execute no Neon:
psql $DATABASE_URL < agendamentos-schema.sql

# 2. Teste o backend:
npm run dev

# 3. Teste endpoint:
curl "http://localhost:3000/agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15&servico_id=2"

# 4. Atualize frontend com novos URLs
```

---

**Resumo em 1 linha**: hora_inicio/hora_fim é o melhor porque é como todo software profissional faz, é mais rápido e suporta tudo que você vai precisar.
