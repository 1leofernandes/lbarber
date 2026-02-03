# Correção do Sistema de Desconto por Assinatura

## Problema Identificado

O sistema de desconto não estava sendo aplicado nos agendamentos, mesmo que o usuário fosse assinante e o serviço estivesse incluído no plano.

### Causa Raiz

1. **Tabela `assinaturas_usuarios` desatualizada**: O registro de assinatura do usuário tinha `plano_id = 1` mas deveria ser `plano_id = 2`
2. **Campo `assinatura_usuario_id` não preenchido**: Os agendamentos não tinham vinculação com a assinatura ativa do usuário

### Exemplo Prático

- **Usuário 12 (cliente)**: Assinante com `assinatura_id = 2` (Corte + Barba)
- **Assinatura 2**: Cobre serviços 1, 2, 3 nos dias 1, 2, 3 (seg, ter, qua)
- **Agendamento ID 24**: 2026-02-03 (terça-feira = dia 2), Serviço 1 (Corte R$ 45)
- **Problema**: Valor total exibido como R$ 45 em vez de R$ 0

## Soluções Aplicadas

### 1. Atualizar `assinaturas_usuarios`

```sql
UPDATE assinaturas_usuarios 
SET plano_id = 2
WHERE usuario_id = 12;
```

### 2. Atualizar campo `assinatura_usuario_id` nos agendamentos

```sql
UPDATE agendamentos a
SET assinatura_usuario_id = au.id
FROM assinaturas_usuarios au
WHERE a.usuario_id = au.usuario_id
  AND au.status = 'ativa'
  AND au.data_inicio <= a.data_agendada
  AND (au.data_fim IS NULL OR au.data_fim >= a.data_agendada)
  AND a.assinatura_usuario_id IS NULL;
```

### 3. Resultado Final

Após as correções, o agendamento ID 24 agora mostra:
- **Serviço**: Corte Social (R$ 45)
- **Dia**: Terça-feira (coberta pela assinatura)
- **Valor Total**: **R$ 0** ✅ (desconto aplicado corretamente)

## Como o Cálculo Funciona

A query de `valor_total` no modelo `Appointment.js` verifica 3 condições:

```javascript
CASE
  WHEN u.assinante = true                    // Usuário é assinante?
    AND u.assinatura_id IS NOT NULL         // Tem plano ativo?
    AND EXISTS (                             // Serviço está no plano?
      SELECT 1 FROM assinatura_servico 
      WHERE assinatura_id = u.assinatura_id 
      AND servico_id = s.id
    )
    AND EXISTS (                             // Dia da semana é coberto?
      SELECT 1 FROM assinatura_dias_semana 
      WHERE assinatura_id = u.assinatura_id 
      AND dia_semana = EXTRACT(ISODOW FROM a.data_agendada)::int
    )
  THEN 0                                      // Gratuito!
  ELSE COALESCE(s.valor_servico, 0)         // Cobrar normalmente
END
```

## Verificação

Para confirmar que descontos estão funcionando:

```javascript
node fix-future.js
```

Saída esperada:
```
ID 24: cliente | 03/02/2026 (dia 2) | Corte Social | R$ 45.00 -> R$ 0 ✅ DESCONTO
```

## Próximos Passos

1. ✅ Verificar que novos agendamentos preenchem `assinatura_usuario_id` automaticamente
2. ✅ Confirmar que o frontend exibe R$ 0 para serviços com desconto
3. Limpar scripts de debug
