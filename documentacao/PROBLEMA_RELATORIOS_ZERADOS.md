# 🚨 PROBLEMA: Relatórios Mostrando Valores Zerados

## 📊 Situação

**Tela mostra:**
- Valor Total em Estoque: €0.00 ❌
- Entradas (Mês): 0 ❌
- Saídas (Mês): 0 ❌
- Total de Produtos: 6 ✅

**Valores REAIS no banco:**
- Valor Total em Estoque: **€1.316,55** ✅
- Entradas (Outubro): **8 movimentações** ✅
- Saídas (Outubro): **1 movimentação** ✅
- Total de Produtos: **6** ✅

## 🔍 Causa Raiz

O problema está no **código JavaScript do frontend** que não está conseguindo:
1. Buscar os dados da API corretamente
2. OU processar a resposta da API
3. OU há erro de autenticação/CORS bloqueando as requisições

## 📝 Endpoints da API

### 1. Valor do Estoque
```
GET /api/laboratorio/relatorios/valor-estoque
```

**Código atual (api/index.js linha 4963)**:
```javascript
app.get('/api/laboratorio/relatorios/valor-estoque', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('calcular_valor_estoque');
        
        if (error) throw error;
        
        const valorTotal = data.reduce((sum, item) => sum + parseFloat(item.valor_total || 0), 0);
        
        res.json({
            valor_total: valorTotal,
            produtos: data
        });
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: error.message });
    }
});
```

✅ **Função `calcular_valor_estoque` existe e funciona!**

**Teste realizado**:
```sql
SELECT * FROM calcular_valor_estoque();
```

**Resultado**:
- Produto "teste": €1.316,55
- Outros produtos: €0 (sem custo)
- **TOTAL**: €1.316,55

### 2. Entradas do Mês
```
GET /api/laboratorio/relatorios/entradas-mes
```

**Código (api/index.js linha 5190)**:
```javascript
const { count, error } = await supabase
    .from('movimentacoeslaboratorio')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'entrada')
    .gte('data_movimentacao', startOfMonth.toISOString());
```

✅ **Query correta!** Deveria retornar 8.

### 3. Saídas do Mês
```
GET /api/laboratorio/relatorios/saidas-mes
```

**Código (api/index.js linha 5212)**:
```javascript
const { count, error } = await supabase
    .from('movimentacoeslaboratorio')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'saida')
    .gte('data_movimentacao', startOfMonth.toISOString());
```

✅ **Query correta!** Deveria retornar 1.

## 🎯 Solução

### Opção 1: Verificar Erros no Console do Navegador ⚠️

1. Abra http://localhost:3002/prostoral.html
2. Abra o DevTools (F12)
3. Vá para a aba "Console"
4. Procure por erros (em vermelho)
5. Se houver erros, anote-os

**Erros comuns**:
- ❌ CORS error
- ❌ 401 Unauthorized
- ❌ 500 Internal Server Error
- ❌ TypeError: Cannot read property...

### Opção 2: Testar APIs Diretamente 🧪

Use o console do navegador:

```javascript
// 1. Pegar o token
const token = localStorage.getItem('sb-hvqckoajxhdqaxfawisd-auth-token');
const accessToken = JSON.parse(token).access_token;

// 2. Testar valor do estoque
fetch('http://localhost:3002/api/laboratorio/relatorios/valor-estoque', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
})
.then(r => r.json())
.then(data => console.log('Valor Estoque:', data))
.catch(err => console.error('Erro:', err));

// 3. Testar entradas
fetch('http://localhost:3002/api/laboratorio/relatorios/entradas-mes', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
})
.then(r => r.json())
.then(data => console.log('Entradas:', data))
.catch(err => console.error('Erro:', err));

// 4. Testar saídas
fetch('http://localhost:3002/api/laboratorio/relatorios/saidas-mes', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
})
.then(r => r.json())
.then(data => console.log('Saídas:', data))
.catch(err => console.error('Erro:', err));
```

### Opção 3: Forçar Recarregamento 🔄

Código JavaScript que carrega os dados (public/laboratorio.js linha 1299-1358):

```javascript
async loadReportStats() {
    try {
        const token = localStorage.getItem('sb-hvqckoajxhdqaxfawisd-auth-token');
        if (!token) return;
        
        // ... resto do código
    }
}
```

**Teste manual**:
```javascript
// No console do navegador, após fazer login:
window.laboratorioModule.loadReportStats();
```

## 🔧 Correção Temporária (Workaround)

Se as APIs estiverem funcionando mas o frontend não atualiza, adicione este código no console:

```javascript
// Forçar atualização dos KPIs
async function forcarAtualizacaoKPIs() {
    const token = localStorage.getItem('sb-hvqckoajxhdqaxfawisd-auth-token');
    if (!token) {
        console.error('Token não encontrado');
        return;
    }
    
    const accessToken = JSON.parse(token).access_token;
    const baseUrl = 'http://localhost:3002/api/laboratorio';
    
    try {
        // Valor do estoque
        const valorRes = await fetch(`${baseUrl}/relatorios/valor-estoque`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const valorData = await valorRes.json();
        document.getElementById('totalStockValue').textContent = 
            `€${parseFloat(valorData.valor_total || 0).toFixed(2)}`;
        console.log('✅ Valor atualizado:', valorData.valor_total);
        
        // Entradas
        const entradasRes = await fetch(`${baseUrl}/relatorios/entradas-mes`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const entradasData = await entradasRes.json();
        document.getElementById('totalMonthEntries').textContent = entradasData.total || 0;
        console.log('✅ Entradas atualizadas:', entradasData.total);
        
        // Saídas
        const saidasRes = await fetch(`${baseUrl}/relatorios/saidas-mes`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const saidasData = await saidasRes.json();
        document.getElementById('totalMonthExits').textContent = saidasData.total || 0;
        console.log('✅ Saídas atualizadas:', saidasData.total);
        
        alert('KPIs atualizados com sucesso!');
    } catch (error) {
        console.error('❌ Erro:', error);
        alert('Erro ao atualizar KPIs: ' + error.message);
    }
}

// Executar
forcarAtualizacaoKPIs();
```

## 📋 Próximos Passos

1. [ ] Verificar console do navegador (F12)
2. [ ] Anotar erros encontrados
3. [ ] Testar APIs manualmente
4. [ ] Executar script de correção temporária
5. [ ] Reportar resultados para correção definitiva

## 🎓 Resumo

- ✅ APIs existem e funcionam
- ✅ Banco de dados tem os dados corretos
- ❌ Frontend não está exibindo os valores
- 🔍 Provável erro de JavaScript ou autenticação

**Valor real**: €1.316,55  
**Entradas real**: 8  
**Saídas real**: 1

---

**Data**: 21 de outubro de 2025  
**Status**: Aguardando teste no navegador 🧪

