// EXEMPLOS PRÁTICOS: AGENDAMENTOS
// ================================

## 1. EXEMPLO REAL: CLIENTE MARCA CORTE

### Passo 1: Frontend busca horários

```javascript
// Dados fixos (exemplo)
const barbeiroId = 1;        // João
const dataAgendada = "2024-01-15";
const servicoId = 2;          // Corte + Barba (60 min)

// Request
const response = await fetch(
  `/agendamentos/disponiveis?barbeiro_id=${barbeiroId}&data_agendada=${dataAgendada}&servico_id=${servicoId}`
);
const dados = await response.json();

// Resposta do backend:
{
  "success": true,
  "horariosDisponiveis": [
    "08:00", "08:30", "09:00", "09:30",
    "10:00", "11:00", "11:30", "13:00", "13:30", "14:00", ...
  ],
  "duracao": "60 minutos"
}

// Frontend mostra: "Disponível de segunda para o seguinte"
// Se fosse "08:00" = tá passado, skip
// Se fosse "10:00" e "10:30" = ambos cabem 60 min
```

### Passo 2: Usuário seleciona horário

```javascript
// Usuário clica "10:00"
const horaInicio = "10:00";

// Frontend envia POST
const response = await fetch('/agendamentos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`  // JWT do cliente
  },
  body: JSON.stringify({
    barbeiro_id: 1,
    servico_id: 2,
    data_agendada: "2024-01-15",
    hora_inicio: "10:00"
  })
});

const resultado = await response.json();

// Backend processa:
// 1. Busca duracao_servico = 60 (do serviço 2)
// 2. Calcula hora_fim = 10:00 + 60min = 11:00
// 3. Verifica: existe overlap entre 10:00-11:00? NÃO
// 4. Insere: (usuario_id=123, barbeiro=1, servico=2, data=15/01, 10:00-11:00)

// Resposta (201 Created):
{
  "success": true,
  "message": "Agendamento realizado com sucesso",
  "appointment": {
    "id": 456,
    "usuario_id": 123,
    "barbeiro_id": 1,
    "servico_id": 2,
    "data_agendada": "2024-01-15",
    "hora_inicio": "10:00",
    "hora_fim": "11:00",
    "status": "confirmado",
    "created_at": "2024-01-10T15:30:00Z"
  }
}
```

### Passo 3: Outro cliente tenta mesmo horário

```javascript
// Outro usuário tenta 10:15
const response = await fetch('/agendamentos', {
  method: 'POST',
  body: JSON.stringify({
    barbeiro_id: 1,
    servico_id: 3,      // Corte (30 min)
    data_agendada: "2024-01-15",
    hora_inicio: "10:15"
  })
});

// Backend:
// 1. Busca duracao = 30 min
// 2. Calcula hora_fim = 10:15 + 30 = 10:45
// 3. Verifica: existe overlap entre 10:15-10:45?
//    Sim! Agendamento anterior: 10:00-11:00
//    Sobreposição: 10:15-10:45 cruza com 10:00-11:00 ✓

// Resposta (409 Conflict):
{
  "success": false,
  "message": "Horário indisponível para este barbeiro",
  "status": 409
}

// Frontend mostra: "Desculpe, este horário foi ocupado. Escolha outro."
```

### Passo 4: Cliente terceiro encontra slot livre

```javascript
// Outro cliente tenta 11:00 (logo após primeiro agendamento)
const response = await fetch('/agendamentos', {
  method: 'POST',
  body: JSON.stringify({
    barbeiro_id: 1,
    servico_id: 3,      // Corte (30 min)
    data_agendada: "2024-01-15",
    hora_inicio: "11:00"
  })
});

// Backend:
// 1. Calcula: 11:00 + 30 = 11:30
// 2. Verifica: overlap 11:00-11:30 com 10:00-11:00? NÃO ✅
// 3. Insere OK

// Resposta (201 Created):
{
  "success": true,
  "appointment": {
    "id": 457,
    "hora_inicio": "11:00",
    "hora_fim": "11:30"
  }
}

// Resultado do dia 15/01:
// 10:00-11:00: João marca Corte + Barba (cliente 1)
// 11:00-11:30: João marca Corte (cliente 2)
// 11:30+: ainda disponível...
```

---

## 2. EXEMPLO: BARBEIRO FAZ PAUSA PARA ALMOÇO

### Passo 1: Barbeiro bloqueia horário manualmente

```bash
# POST /bloqueios (endpoint futuro)
curl -X POST http://localhost:3000/bloqueios \
  -H "Authorization: Bearer TOKEN_JOAO" \
  -H "Content-Type: application/json" \
  -d '{
    "data": "2024-01-15",
    "hora_inicio": "12:00",
    "hora_fim": "13:00",
    "descricao": "Almoço"
  }'

# Backend insere bloqueio
# (Se você não tiver esse endpoint, pode inserir direto no DB)
```

### Passo 2: Cliente tenta agendar durante almoço

```javascript
// Cliente tenta 12:30
const response = await fetch('/agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15');

// Backend retorna:
{
  "horariosDisponiveis": [
    "08:00", "08:30", "09:00", "09:30", "10:00",
    // Pulou 12:00-13:00 (bloqueio)
    "13:00", "13:30", "14:00", ...
  ]
}

// Frontend não mostra 12:00 até 12:59
// Se cliente tenta forçar 12:30:
{
  "success": false,
  "message": "Horário indisponível"
}
```

---

## 3. EXEMPLO: MÚLTIPLOS BARBEIROS

### Cenário

```
João:  8h-18h
Pedro: 8h-18h (mas trabalha terça a sábado)
```

### Cliente escolhe barbeiro

```javascript
// Dia 15/01 (segunda)
GET /agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15
// João: retorna todos horários livres

GET /agendamentos/disponiveis?barbeiro_id=2&data_agendada=2024-01-15
// Pedro: retorna 12:00 a 18:00 (ocupado 8h-12h? bloqueio de férias)

// Cliente escolhe João, agenda 10:00
POST /agendamentos { barbeiro_id: 1, hora_inicio: "10:00" }
// Sucesso

// Outro cliente escolhe Pedro, agenda 13:00
POST /agendamentos { barbeiro_id: 2, hora_inicio: "13:00" }
// Sucesso

// Dia 15/01 10:00: João + Cliente A
// Dia 15/01 13:00: Pedro + Cliente B
// Dois agendamentos simultâneos ✅
```

---

## 4. EXEMPLO: SERVIÇOS COM DURAÇÕES DIFERENTES

### Seu cardápio

```
ID | Nome | Duração | Preço
1  | Corte | 30 min | R$ 25
2  | Barba | 30 min | R$ 20
3  | Corte + Barba | 60 min | R$ 40
4  | Lavagem | 15 min | R$ 10
5  | Tingimento | 90 min | R$ 50
```

### Cliente marca cada um

```javascript
// Serviço 1 (30 min): 09:00-09:30
POST /agendamentos { servico_id: 1, hora_inicio: "09:00" }
// ✅ Ocupa 30 minutos

// Serviço 2 (30 min): 09:30-10:00
POST /agendamentos { servico_id: 2, hora_inicio: "09:30" }
// ✅ Ocupa próximos 30 minutos

// Serviço 3 (60 min): 10:00-11:00
POST /agendamentos { servico_id: 3, hora_inicio: "10:00" }
// ✅ Ocupa 60 minutos

// Serviço 5 (90 min): 14:00-15:30
POST /agendamentos { servico_id: 5, hora_inicio: "14:00" }
// ✅ Ocupa 90 minutos (raro!)

// Timeline de João:
// 09:00-09:30: Corte (cliente A)
// 09:30-10:00: Barba (cliente B)
// 10:00-11:00: Corte + Barba (cliente C)
// 11:00-14:00: LIVRE
// 14:00-15:30: Tingimento (cliente D)
// 15:30-18:00: LIVRE
```

---

## 5. EXEMPLO: BACKEND CALCULA HORA_FIM

### Você envia

```javascript
POST /agendamentos
{
  barbeiro_id: 1,
  servico_id: 5,            // Tingimento (90 min)
  data_agendada: "2024-01-15",
  hora_inicio: "14:00"
  // Você NÃO envia hora_fim!
}
```

### Backend faz

```javascript
// 1. SELECT duracao_servico FROM servicos WHERE id = 5
// Resultado: 90

// 2. Calcula:
const [h, m] = "14:00".split(':')  // [14, 0]
const inicio = new Date(0, 0, 0, 14, 0)
const fim = new Date(inicio.getTime() + 90 * 60000)  // +90 min
const hora_fim = "15:30"

// 3. Verifica conflito:
WHERE barbeiro_id = 1
  AND data_agendada = '2024-01-15'
  AND hora_inicio < '15:30'     // sua hora_fim
  AND hora_fim > '14:00'         // sua hora_inicio
  AND status != 'cancelado'
// Resultado: nenhum conflito ✅

// 4. Insere:
INSERT INTO agendamentos (..., hora_inicio, hora_fim)
VALUES (..., '14:00', '15:30')
```

### Você recebe

```javascript
{
  "success": true,
  "appointment": {
    "hora_inicio": "14:00",
    "hora_fim": "15:30"      // ← Backend calculou!
  }
}
```

---

## 6. EXEMPLO: QUERY DE CONFLITO

### Cenário: Verificar disponibilidade

**Agendamentos existentes:**

```sql
id | barbeiro_id | data | hora_inicio | hora_fim | status
1  | 1 | 2024-01-15 | 09:00 | 09:30 | confirmado
2  | 1 | 2024-01-15 | 10:00 | 11:00 | confirmado
3  | 1 | 2024-01-15 | 14:00 | 15:30 | confirmado
```

**Bloqueios:**

```sql
id | id_barbeiro | data | hora_inicio | hora_fim | descricao
1  | 1 | 2024-01-15 | 12:00 | 13:00 | Almoço
```

### Query: Hora 10:30 + 30 minutos cabe?

```sql
-- Verifica: 10:30-11:00 tem conflito?
SELECT COUNT(*) FROM agendamentos
WHERE barbeiro_id = 1
  AND data_agendada = '2024-01-15'
  AND hora_inicio < '11:00'      -- slot_fim
  AND hora_fim > '10:30'         -- slot_inicio
  AND status != 'cancelado';

-- Resultado: 1 (sim, agendamento 2: 10:00-11:00 conflita)
-- ❌ NÃO CABE
```

### Query: Hora 11:00 + 30 minutos cabe?

```sql
SELECT COUNT(*) FROM agendamentos
WHERE barbeiro_id = 1
  AND data_agendada = '2024-01-15'
  AND hora_inicio < '11:30'      -- slot_fim
  AND hora_fim > '11:00'         -- slot_inicio
  AND status != 'cancelado';

-- Resultado: 0 (não há conflito)
-- ✅ CABE
```

### Query: Hora 12:00 + 30 minutos cabe?

```sql
-- Agendamentos:
SELECT COUNT(*) FROM agendamentos WHERE ... (resultado 0)

-- Bloqueios:
SELECT COUNT(*) FROM bloqueios
WHERE id_barbeiro = 1
  AND data = '2024-01-15'
  AND hora_inicio < '12:30'
  AND hora_fim > '12:00';

-- Resultado: 1 (sim, bloqueio de almoço 12:00-13:00)
-- ❌ NÃO CABE (é horário de almoço)
```

---

## 7. EXEMPLO: LISTAGEM DE DISPONIBILIDADES

### Requisição

```bash
GET /agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15&servico_id=3
```

### Backend processa

```javascript
// 1. Busca duração
SELECT duracao_servico FROM servicos WHERE id = 3
// Resultado: 60 (Corte + Barba)

// 2. Busca indisponibilidades
SELECT hora_inicio, hora_fim FROM agendamentos
WHERE barbeiro_id = 1 AND data_agendada = '2024-01-15'
UNION
SELECT hora_inicio, hora_fim FROM bloqueios
WHERE id_barbeiro = 1 AND data = '2024-01-15'

// Resultado:
// [
//   { hora_inicio: "09:00", hora_fim: "09:30" },
//   { hora_inicio: "10:00", hora_fim: "11:00" },
//   { hora_inicio: "12:00", hora_fim: "13:00" },
//   { hora_inicio: "14:00", hora_fim: "15:30" }
// ]

// 3. Gera slots (30 em 30 min)
// [08:00, 08:30, 09:00, 09:30, 10:00, ..., 17:30]

// 4. Filtra slots que cabem 60 minutos
// Para 08:00: 08:00-09:00 cruza 09:00-09:30? NÃO ✅
// Para 09:00: 09:00-10:00 cruza 10:00-11:00? NÃO ✅
// Para 09:30: 09:30-10:30 cruza 10:00-11:00? SIM ❌
// Para 10:00: 10:00-11:00 = EXATO com agendamento ❌
// Para 10:30: 10:30-11:30 cruza com bloqueio 12:00? NÃO ✅
// Para 11:00: 11:00-12:00 cruza bloqueio 12:00-13:00? SIM ❌
// Para 11:30: 11:30-12:30 cruza bloqueio? SIM ❌
// Para 13:00: 13:00-14:00 cruza 14:00-15:30? NÃO ✅
// Para 13:30: 13:30-14:30 cruza 14:00-15:30? SIM ❌
// Para 15:30: 15:30-16:30 cruza? NÃO ✅
// Para 16:00: 16:00-17:00 cruza? NÃO ✅
// Para 16:30: 16:30-17:30 cruza? NÃO ✅
// Para 17:00: 17:00-18:00 cruza? NÃO ✅
```

### Resposta

```json
{
  "success": true,
  "horariosDisponiveis": [
    "08:00", // 08:00-09:00 livre
    "09:00", // 09:00-10:00 livre (após corte)
    "10:30", // 10:30-11:30 livre (após Corte+Barba)
    "13:00", // 13:00-14:00 livre (após almoço)
    "15:30", // 15:30-16:30 livre (após tingimento)
    "16:00", // 16:00-17:00 livre
    "16:30", // 16:30-17:30 livre
    "17:00" // 17:00-18:00 livre
  ],
  "duracao": "60 minutos"
}
```

**Frontend mostra:** 08:00, 09:00, 10:30, 13:00, 15:30, 16:00, 16:30, 17:00

---

## 8. VALIDAÇÕES AUTOMÁTICAS (SQL)

```sql
-- Hora_fim deve ser MAIOR que hora_inicio
ALTER TABLE agendamentos ADD CONSTRAINT check_hora_valida
CHECK (hora_fim > hora_inicio);

-- Não pode agendar para passado
ALTER TABLE agendamentos ADD CONSTRAINT check_data_futura
CHECK (data_agendada >= CURRENT_DATE);

-- Barbeiro não agenda consigo
ALTER TABLE agendamentos ADD CONSTRAINT check_mesmo_barbeiro
CHECK (barbeiro_id != usuario_id);
```

**Resultado:** Banco rejeita dados inválidos 🔒

---

## 🎯 RESUMO

| Cenário                   | Ação                         | Resultado                             |
| ------------------------- | ---------------------------- | ------------------------------------- |
| Cliente marca corte 30min | POST com hora_inicio="10:00" | Backend calcula 10:00-10:30, bloqueia |
| Outro tenta 10:15         | POST com hora_inicio="10:15" | Erro 409, há overlap com 10:00-30     |
| Cliente tenta 10:30       | POST com hora_inicio="10:30" | Sucesso, 10:30-11:00 livre            |
| Barbeiro pausa            | POST /bloqueios 12:00-13:00  | GET /disponiveis pula 12:00           |
| Duração 60min             | GET com servico_id=3         | Retorna slots com 60min livres        |
| Múltiplos barbeiros       | GET barbeiro_id=1 vs 2       | Cada um tem agenda independente       |

---

**Isso é tudo que você precisa entender!** 🚀
