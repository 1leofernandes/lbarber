// ====================================
// TESTE RÁPIDO - GOOGLE OAUTH
// ====================================

// Para testar, copie e cole este arquivo em um terminal Node.js
// ou execute com: node test-google-oauth.js

console.log('🧪 Teste de Configuração Google OAuth\n');

// 1. Verificar variáveis de ambiente
console.log('1️⃣  Verificando variáveis de ambiente...');
const requiredEnvs = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'BACKEND_URL',
  'SESSION_SECRET'
];

const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error(`❌ Variáveis faltando: ${missingEnvs.join(', ')}`);
  console.log('\n📝 Configure em .env:');
  missingEnvs.forEach(env => {
    console.log(`  ${env}=seu_valor_aqui`);
  });
  process.exit(1);
} else {
  console.log('✅ Todas as variáveis de ambiente configuradas!\n');
}

// 2. Verificar dependências
console.log('2️⃣  Verificando dependências...');
const dependencies = [
  'passport',
  'passport-google-oauth20',
  'express-session',
  'express'
];

dependencies.forEach(dep => {
  try {
    require(dep);
    console.log(`✅ ${dep}`);
  } catch (err) {
    console.error(`❌ ${dep} - não instalado`);
    console.log(`   Execute: npm install ${dep}`);
  }
});

// 3. Informações de configuração
console.log('\n3️⃣  Informações de configuração:');
console.log(`Backend URL: ${process.env.BACKEND_URL}`);
console.log(`Callback URL: ${process.env.BACKEND_URL}/auth/google/callback`);
console.log(`Google Client ID: ${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...`);

// 4. URLs que precisam estar no Google Cloud Console
console.log('\n4️⃣  URLs que precisam estar no Google Cloud Console:');
console.log('   Origem autorizada:');
console.log(`   - ${process.env.BACKEND_URL}`);
console.log('   Redirecionamento autorizado:');
console.log(`   - ${process.env.BACKEND_URL}/auth/google/callback`);

// 5. Próximos passos
console.log('\n5️⃣  Próximos passos:');
console.log('   1. Instale as dependências: npm install');
console.log('   2. Inicie o servidor: npm run dev');
console.log('   3. Acesse: http://localhost:3000/login.html');
console.log('   4. Clique em "Entrar com Google"');

console.log('\n✅ Teste concluído!\n');
