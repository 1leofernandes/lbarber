# Google OAuth - Setup Rápido

## 🎯 Resumo

Google OAuth foi integrado à sua aplicação. Totalmente **GRÁTIS**, sem limite de usuários.

## ⚙️ Configuração (3 passos)

### 1. Obter Credenciais Google

- Acesse: https://console.cloud.google.com/
- Crie um projeto
- Ative a API Google+
- Crie credenciais OAuth 2.0 (tipo: Aplicação da Web)
- Adicione nas URLs autorizadas:
  ```
  http://localhost:3000
  https://seu-dominio.com
  ```
- Copie: Client ID e Client Secret

### 2. Configurar .env

```env
GOOGLE_CLIENT_ID=seu_id_aqui
GOOGLE_CLIENT_SECRET=seu_secret_aqui
BACKEND_URL=http://localhost:3000
SESSION_SECRET=gere_uma_string_aleatoria_aqui
```

### 3. Instalar e Testar

```bash
npm install
npm run dev
# Acesse: http://localhost:3000/login.html
# Clique em "Entrar com Google"
```

## 📊 Fluxo

```
Usuário clica "Entrar com Google"
           ↓
Redireciona para Google (consentimento)
           ↓
Usuário autoriza
           ↓
Sistema busca/cria usuário no banco
           ↓
Gera JWT token
           ↓
✅ Logado!
```

p

## 📁 Arquivos Modificados

- `package.json` - Dependências adicionadas
- `server.js` - Passport + Sessions inicializadas
- `src/config/passport.js` - Estratégia Google OAuth
- `src/routes/auth.js` - Rotas /auth/google
- `src/controllers/authController.js` - Callback
- `public/login.html` - Botão "Entrar com Google"
- `.env.example` - Variáveis de ambiente
- `google-oauth-migrations.sql` - Script SQL (se precisar adicionar coluna)

## 🔐 Dados Salvos

```javascript
{
  id: 1,
  nome: "Nome do Google",
  email: "email@gmail.com",
  google_id: "ID_unico_do_google",
  role: "cliente",
  telefone: "",
  criado_em: "data_hora",
  atualizado_em: "data_hora"
}
```

## 🆘 Troubleshooting

| Problema                     | Solução                               |
| ---------------------------- | ------------------------------------- |
| "Invalid redirect_uri"       | Adicione URLs no Google Cloud Console |
| "GOOGLE_CLIENT_ID not found" | Configure .env e reinicie o servidor  |
| Botão não aparece            | Abra F12 no navegador e procure erros |
| CORS error                   | Verifique corsOptions no server.js    |

## ✨ Recursos

- ✅ OAuth 2.0 seguro
- ✅ Criação automática de usuários
- ✅ JWT tokens
- ✅ Sessions gerenciadas
- ✅ 100% gratuito
- ✅ Sem limite de usuários

---

**Tudo pronto! Siga os 3 passos acima e seu Google OAuth funcionará perfeitamente.**
