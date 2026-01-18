// CHECKLIST: ADAPTAR BACKEND À SUA BARBEARIA
// ===========================================

## ✅ FASE 1: BACKEND JÁ ADAPTADO (FEITO)

- [x] Mapeamento de colunas (nome_servico → servico)
- [x] Redesign Appointment.js (hora_inicio/hora_fim)
- [x] Lógica de duração automática
- [x] Endpoints atualizados
- [x] Índices de banco otimizados
- [x] Documentação completa

**Status**: ✅ PRONTO PARA USAR

---

## ⏳ FASE 2: VOCÊ EXECUTA (AGORA)

### Passo 1: Criar Tabela (5 min)

```bash
# Abra pgAdmin, DBeaver, ou terminal e execute:
psql $DATABASE_URL < agendamentos-schema.sql

# Ou copie-cole do arquivo agendamentos-schema.sql
```

**Checklist**:

- [ ] Conectou ao Neon
- [ ] Executou SQL
- [ ] Tabela `agendamentos` criada
- [ ] Índices criados

**Validar**:

```sql
-- Execute no seu DB:
SELECT table_name FROM information_schema.tables WHERE table_name='agendamentos';
-- Deve retornar: agendamentos ✅
```

### Passo 2: Testar Backend (10 min)

```bash
cd d:\Área\ de\ Trabalho\Barbearia
npm run dev

# Você deve ver:
# Server running on port 3000
# Database connected
```

**Checklist**:

- [ ] Terminal não tem erros
- [ ] Ver "Database connected"
- [ ] Servidor rodando porta 3000

### Passo 3: Testar Endpoint (5 min)

**Abra Postman, Insomnia, ou Terminal:**

```bash
# Terminal Windows:
curl "http://localhost:3000/agendamentos/disponiveis?barbeiro_id=1&data_agendada=2024-01-15&servico_id=2"

# Esperado: JSON com horários
{
  "success": true,
  "horariosDisponiveis": ["08:00", "08:30", ...],
  "duracao": "60 minutos"
}
```

**Checklist**:

- [ ] Requisição enviada
- [ ] Resposta 200 OK
- [ ] JSON tem `horariosDisponiveis`
- [ ] Duração correta

### Passo 4: Atualizar Frontend (20 min)

**Procure por URLs antigos nos arquivos HTML:**

**Buscar:**

```bash
# Encontre:
POST /agendar
GET /horarios
GET /agendamentos/barbeiro
```

**Substituir por:**

```javascript
// Para listar horários:
GET /agendamentos/disponiveis?barbeiro_id=X&data_agendada=Y&servico_id=Z

// Para criar agendamento:
POST /agendamentos
Body: {
  barbeiro_id: 1,
  servico_id: 2,
  data_agendada: "2024-01-15",
  hora_inicio: "10:00"
}

// Para listar agendamentos do barbeiro:
GET /agendamentos/barbeiro
```

**Checklist**:

- [ ] Encontrou URLs antigas em HTML
- [ ] Substituiu por novas URLs
- [ ] Testou fluxo completo

---

## 🎯 FASE 3: VALIDAÇÃO (15 min)

### Teste 1: Criar Agendamento (sem conflito)

```bash
# 1. Clique "Agendar" no frontend
# 2. Selecione barbeiro, serviço, data
# 3. Sistema mostra horários
# 4. Clique em 10:00
# 5. Sistema cria agendamento
```

**Esperado**: ✅ Sucesso, você recebe confirmação

### Teste 2: Conflito de Horário

```bash
# Mesmo agendamento 2x
# 1. Crie agendamento 10:00-10:30
# 2. Tente criar 10:15-10:45
# 3. Sistema rejeita
```

**Esperado**: ❌ Erro 409 "Horário indisponível"

### Teste 3: Duração Variável

```bash
# 1. Crie 3 serviços: 30, 60, 90 minutos
# 2. Para cada um, teste horários disponíveis
# 3. Cada um deve bloquear tempo certo
```

**Esperado**: ✅ Bloqueio correto em minutos diferentes

---

## 📱 FASE 4: DEPLOY (30 min)

### Deploy Backend

```bash
# 1. Commit suas mudanças
git add .
git commit -m "Adaptar agendamentos para hora_inicio/hora_fim"
git push

# 2. Render atualiza automaticamente
# Acesse: https://seu-app.onrender.com
```

**Checklist**:

- [ ] Código enviado para GitHub
- [ ] Render re-deploying (aguarde 5-10 min)
- [ ] Status "deployed" verde
- [ ] Testar URL de produção

### Deploy Frontend

```bash
# Se frontend está em outro lugar:
# 1. Atualize URLs
# 2. Deploy para Vercel/Netlify/etc
# 3. Teste agendamento no app
```

**Checklist**:

- [ ] Frontend links URL corrigidos
- [ ] Deploy realizado
- [ ] Agendamento funciona de ponta a ponta

---

## 🚨 SE DER ERRO

### Erro 1: "Table agendamentos does not exist"

```
❌ Você pulou Passo 1
✅ Execute: psql $DATABASE_URL < agendamentos-schema.sql
```

### Erro 2: "Column hora_inicio does not exist"

```
❌ Tabela antigo? Você tem estrutura diferente?
✅ Avise-me a estrutura exata (rode: SELECT * FROM agendamentos LIMIT 0;)
```

### Erro 3: "Cannot find module 'Service'"

```
❌ Arquivo Service.js não existe ou caminho errado
✅ Verifique: ls -la src/models/
```

### Erro 4: "POST /agendamentos returns 404"

```
❌ Rota não registrada
✅ Verifique routes/ tem appointmentRoutes.js registrada em server.js
```

### Erro 5: "Token inválido"

```
❌ JWT expirado ou inválido
✅ Faça login de novo, copie novo token
```

---

## 📊 RESUMO DE TEMPO

| Fase               | Tempo         | Status   |
| ------------------ | ------------- | -------- |
| Backend adaptado   | ~4h           | ✅ FEITO |
| Criar tabela       | 5 min         | ⏳ VOCÊ  |
| Testar backend     | 10 min        | ⏳ VOCÊ  |
| Testar endpoint    | 5 min         | ⏳ VOCÊ  |
| Atualizar frontend | 20 min        | ⏳ VOCÊ  |
| Testes validação   | 15 min        | ⏳ VOCÊ  |
| Deploy             | 30 min        | ⏳ VOCÊ  |
| **TOTAL VOCÊ**     | **~1h 25min** | ⏳       |

---

## 💡 DICAS

1. **Teste tudo localmente PRIMEIRO**

   - npm run dev
   - Postman/curl
   - Frontend local
   - SÓ DEPOIS deploy

2. **Se travar, reinicie servidor**

   ```bash
   # Ctrl+C para parar
   npm run dev  # Para rodar de novo
   ```

3. **Verifique .env**

   ```
   DATABASE_URL deve ter credencial Neon
   JWT_SECRET deve estar lá
   ```

4. **Se dúvidas, leia a documentação**
   - [ARQUITETURA-AGENDAMENTOS.md](ARQUITETURA-AGENDAMENTOS.md)
   - [IMPLEMENTACAO-AGENDAMENTOS.md](IMPLEMENTACAO-AGENDAMENTOS.md)

---

## ✨ RESULTADO ESPERADO

Após completar TODOS os passos:

✅ Cliente clica "Agendar"
✅ Sistema mostra horários disponíveis (duração correta)
✅ Cliente seleciona horário
✅ Sistema cria agendamento com hora_inicio e hora_fim
✅ Próximos agendamentos respeita bloqueio
✅ Tudo funcionando em local e produção

---

**Começar agora!** 🚀

Primeira coisa: Execute agendamentos-schema.sql no Neon
