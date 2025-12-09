const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Configurar Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Armazenamento temporário de códigos (em produção, use Redis)
const codeStore = new Map();

/**
 * Gera código temporário para troca de token
 * POST /api/auth/generate-code
 * Header: Authorization: Bearer <token>
 */
router.post('/generate-code', async (req, res) => {
    try {
        // Obter token do header de autorização
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('⚠️ Token não fornecido');
            return res.status(401).json({
                success: false,
                error: 'Token não fornecido'
            });
        }

        const token = authHeader.substring(7);

        // Validar token com Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.warn('⚠️ Token inválido:', error?.message);
            return res.status(401).json({
                success: false,
                error: 'Token inválido'
            });
        }

        // Gerar código aleatório seguro (32 bytes = 256 bits)
        const code = crypto.randomBytes(32).toString('base64url');

        // Armazenar mapeamento code → token
        codeStore.set(code, {
            token: token,
            userId: user.id,
            userEmail: user.email,
            createdAt: Date.now(),
            used: false
        });

        console.log(`✅ Código gerado para ${user.email}: ${code.substring(0, 10)}...`);

        // Limpar código após 1 minuto
        setTimeout(() => {
            if (codeStore.has(code)) {
                console.log(`🗑️ Código expirado: ${code.substring(0, 10)}...`);
                codeStore.delete(code);
            }
        }, 60000); // 1 minuto

        res.json({
            success: true,
            code: code,
            expiresIn: 60 // segundos
        });

    } catch (error) {
        console.error('❌ Erro ao gerar código:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar código'
        });
    }
});

/**
 * Troca código por token
 * POST /api/auth/exchange-code
 * Body: { code: "..." }
 */
router.post('/exchange-code', async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            console.warn('⚠️ Código não fornecido');
            return res.status(400).json({
                success: false,
                error: 'Código não fornecido'
            });
        }

        // Verificar se código existe
        const codeData = codeStore.get(code);

        if (!codeData) {
            console.warn(`⚠️ Código não encontrado ou expirado: ${code.substring(0, 10)}...`);
            return res.status(404).json({
                success: false,
                error: 'Código inválido ou expirado'
            });
        }

        // Verificar se já foi usado (prevenir replay attack)
        if (codeData.used) {
            console.warn(`⚠️ Código já foi usado: ${code.substring(0, 10)}... (usuário: ${codeData.userEmail})`);
            return res.status(409).json({
                success: false,
                error: 'Código já foi utilizado'
            });
        }

        // Verificar expiração (1 minuto)
        const age = Date.now() - codeData.createdAt;
        if (age > 60000) {
            console.warn(`⚠️ Código expirado (${Math.round(age / 1000)}s): ${code.substring(0, 10)}...`);
            codeStore.delete(code);
            return res.status(410).json({
                success: false,
                error: 'Código expirado'
            });
        }

        // Marcar como usado
        codeData.used = true;

        // Retornar token
        const token = codeData.token;

        console.log(`✅ Código trocado com sucesso: ${code.substring(0, 10)}... (usuário: ${codeData.userEmail})`);

        // Remover código do store após 5 segundos
        setTimeout(() => {
            codeStore.delete(code);
        }, 5000);

        res.json({
            success: true,
            token: token,
            user: {
                id: codeData.userId,
                email: codeData.userEmail
            }
        });

    } catch (error) {
        console.error('❌ Erro ao trocar código:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao trocar código'
        });
    }
});

/**
 * Limpar códigos expirados periodicamente
 */
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [code, data] of codeStore.entries()) {
        if (now - data.createdAt > 60000) {
            codeStore.delete(code);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Limpeza automática: ${cleaned} códigos expirados removidos`);
    }
}, 30000); // A cada 30 segundos

/**
 * ROTA: Logout de aplicação externa
 * Quando um módulo externo faz logout, ele pode chamar essa rota
 * para fazer logout no ERP também
 */
router.post('/logout-external', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Token não fornecido'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        console.log('🚪 Logout externo solicitado');

        // Fazer logout no Supabase
        const { error: signOutError } = await supabase.auth.signOut();
        
        if (signOutError) {
            console.error('⚠️ Erro ao fazer logout no Supabase:', signOutError);
        }

        console.log('✅ Logout externo realizado com sucesso');
        
        res.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro no logout externo:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao processar logout'
        });
    }
});

module.exports = router;
