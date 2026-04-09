// scripts/clear-service-cache.js
const cache = require('../src/utils/cache');

async function clearServiceCache() {
    console.log('🧹 Limpando cache de serviços...');
    
    const cacheKey = 'servicos:list:all';
    const result = await cache.del(cacheKey);
    
    if (result) {
        console.log('✅ Cache limpo com sucesso!');
    } else {
        console.log('⚠️ Cache já estava vazio ou chave não existe');
    }
    
    // Mostrar o que ainda está em cache
    const allKeys = await cache.keys('*');
    console.log('📦 Chaves restantes no cache:', allKeys);
    
    process.exit(0);
}

clearServiceCache();