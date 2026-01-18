// COMANDOS PRÁTICOS - COPY & PASTE
// ================================

## 1. CRIAR TABELA NO NEON (Windows PowerShell)

### Opção A: Via terminal (se tiver psql instalado)

```powershell
$env:DATABASE_URL = "postgresql://user:password@db.neon.tech/database?sslmode=require"
psql $env:DATABASE_URL < agendamentos-schema.sql
```

### Opção B: Via pgAdmin (GUI)

1. Abra pgAdmin
2. Connect ao seu Neon
3. Abra Query Tool
4. Copy & paste conteúdo de agendamentos-schema.sql
5. Execute (F5)

### Opção C: Verificar se foi criado

```sql
SELECT table_name FROM information_schema.tables WHERE table_name='agendamentos';
-- Deve retornar: agendamentos ✅
```

---

## 2. TESTAR BACKEND (Terminal)

### Iniciar servidor

```bash
cd d:\Área\ de\ Trabalho\Barbearia
npm run dev
```

### Esperado ver:

```
Server running on port 3000
Database connected
```

---

## 3. TESTAR ENDPOINT GET (Para listar horários)

### Via PowerShell:

```powershell
$uri = "http://localhost:3000/agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15&servico_id=2"
Invoke-RestMethod -Uri $uri -Method GET
```

### Via curl (se tiver):

```bash
curl "http://localhost:3000/agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15&servico_id=2"
```

### Via Postman:

```
GET http://localhost:3000/agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15&servico_id=2
Headers: (none)
Body: (none)
Click: Send
```

### Esperado resposta:

```json
{
  "success": true,
  "horariosDisponiveis": ["08:00", "08:30", "09:00", ...],
  "duracao": "60 minutos"
}
```

---

## 4. TESTAR ENDPOINT POST (Para criar agendamento)

### Você precisa de um JWT token PRIMEIRO:

```
1. Faça login via POST /login
2. Copie o token da resposta
3. Use no Header Authorization abaixo
```

### Via PowerShell:

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer SEU_JWT_TOKEN_AQUI"
}

$body = @{
    barbeiro_id = 1
    servico_id = 2
    data_agendada = "2024-01-15"
    hora_inicio = "10:00"
} | ConvertTo-Json

$uri = "http://localhost:3000/agendamentos"
Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
```

### Via curl:

```bash
curl -X POST http://localhost:3000/agendamentos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "barbeiro_id": 1,
    "servico_id": 2,
    "data_agendada": "2024-01-15",
    "hora_inicio": "10:00"
  }'
```

### Via Postman:

```
POST http://localhost:3000/agendamentos
Headers:
  Content-Type: application/json
  Authorization: Bearer SEU_TOKEN
Body (raw JSON):
{
  "barbeiro_id": 1,
  "servico_id": 2,
  "data_agendada": "2024-01-15",
  "hora_inicio": "10:00"
}
Click: Send
```

### Esperado resposta:

```json
{
  "success": true,
  "message": "Agendamento realizado com sucesso",
  "appointment": {
    "id": 123,
    "usuario_id": 456,
    "barbeiro_id": 1,
    "servico_id": 2,
    "data_agendada": "2024-01-15",
    "hora_inicio": "10:00",
    "hora_fim": "11:00",
    "status": "confirmado"
  }
}
```

---

## 5. TESTAR CONFLITO (Para verificar error handling)

### Tente agendar no MESMO horário:

```powershell
# Primeiro agendamento: 10:00-10:30 (OK)
# Segundo agendamento: 10:15-10:45 (deve dar erro)

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer OUTRO_TOKEN"
}

$body = @{
    barbeiro_id = 1
    servico_id = 2
    data_agendada = "2024-01-15"
    hora_inicio = "10:15"  # Conflita com 10:00-10:30
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/agendamentos" -Method POST -Headers $headers -Body $body
```

### Esperado resposta (409 Conflict):

```json
{
  "success": false,
  "message": "Horário indisponível para este barbeiro",
  "status": 409
}
```

---

## 6. VERIFICAR ÍNDICES NO BANCO

### Ver se índices foram criados:

```sql
SELECT indexname FROM pg_stat_user_indexes
WHERE tablename = 'agendamentos';

-- Deve retornar:
-- idx_agendamentos_barbeiro_data
-- idx_agendamentos_intervalo
```

### Se faltarem índices, execute:

```sql
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_data
ON agendamentos(barbeiro_id, data_agendada);

CREATE INDEX IF NOT EXISTS idx_agendamentos_intervalo
ON agendamentos(barbeiro_id, data_agendada, hora_inicio, hora_fim);
```

---

## 7. DEPLOY PARA PRODUÇÃO

### 1. Committar mudanças:

```bash
git add .
git commit -m "Adaptar agendamentos para hora_inicio/hora_fim"
git push
```

### 2. Render atualiza automaticamente

- Aguarde 5-10 minutos
- Acesse: https://seu-app.onrender.com

### 3. Testar em produção:

```bash
# Substituir localhost por URL de produção
curl "https://seu-app.onrender.com/agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15"
```

---

## 8. ATUALIZAR FRONTEND

### Procurar por (Ctrl+F):

```
POST /agendar
GET /horarios
GET /agendamentos/barbeiro
```

### Substituir por:

```javascript
// Listar horários disponíveis:
GET /agendamentos/disponiveis?barbeiro_id=X&data_agendada=Y&servico_id=Z

// Criar agendamento:
POST /agendamentos
Body: {
  barbeiro_id: 1,
  servico_id: 2,
  data_agendada: "2024-01-15",
  hora_inicio: "10:00"
}

// Listar agendamentos do barbeiro:
GET /agendamentos/barbeiro
```

### Exemplo JavaScript:

```javascript
// ANTES (antigo):
async function marcarAgendamento(data, hora) {
  const response = await fetch("/agendar", {
    method: "POST",
    body: JSON.stringify({ data, hora }),
  });
}

// DEPOIS (novo):
async function marcarAgendamento(barbeiroId, servicoId, data, hora) {
  const response = await fetch("/agendamentos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      barbeiro_id: barbeiroId,
      servico_id: servicoId,
      data_agendada: data,
      hora_inicio: hora,
    }),
  });
  return response.json();
}
```

---

## 9. TROUBLESHOOTING

### Erro: "Table agendamentos does not exist"

```bash
# Solução: Execute o SQL novamente
psql $DATABASE_URL < agendamentos-schema.sql
```

### Erro: "Cannot find module"

```bash
# Solução: Reinstale dependências
npm install
```

### Erro: "Connection refused"

```bash
# Solução: Verifique DATABASE_URL no .env
cat .env | grep DATABASE_URL
# Deve ter credencial Neon válida
```

### Erro: 404 Not Found

```bash
# Solução: Verifique se rota existe em server.js
# Procure por: appointmentRoutes
```

### Erro: 401 Unauthorized

```bash
# Solução: Token JWT inválido ou expirado
# Faça login de novo com POST /login
```

---

## 10. MONITORAR LOGS

### Local:

```bash
npm run dev
# Logs aparecem no terminal em tempo real
```

### Produção (Render):

1. Acesse: https://dashboard.render.com
2. Selecione seu app
3. Abra "Logs"
4. Ver logs em tempo real

---

## 📋 CHECKLIST RÁPIDO

```
☐ Executei agendamentos-schema.sql
☐ Verifiquei tabela foi criada
☐ npm run dev funciona
☐ GET /agendamentos/disponiveis retorna dados
☐ POST /agendamentos cria agendamento
☐ POST /agendamentos com conflito retorna erro 409
☐ Atualizei frontend URLs
☐ Fiz git push
☐ Testei em produção
☐ Tudo funcionando ✅
```

---

## 🎯 PRÓXIMA ETAPA

Após executar todos os comandos acima:

1. ✅ Agendamentos funcionam localmente
2. ✅ Agendamentos funcionam em produção
3. ✅ Frontend integ bem com backend
4. ✅ Sistema pronto para usar!

**Tempo total: ~1 hora** ⏱️

---

Boa sorte! 🚀
