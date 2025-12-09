const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do Multer (Memória)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// GET /:employee_id - Listar documentos
router.get('/:employee_id', requirePermission('HR', 'read_own'), async (req, res) => {
    try {
        const { employee_id } = req.params;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        // Verificação de acesso
        if (!isManager) {
            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile || profile.employee_id !== employee_id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
        }

        const { data, error } = await supabase
            .from('rh_documents')
            .select('*')
            .eq('employee_id', employee_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Generate signed URLs for each document (valid for 1 hour)
        const documentsWithSignedUrls = await Promise.all(
            data.map(async (doc) => {
                if (doc.storage_path) {
                    const { data: signedUrlData, error: urlError } = await supabase.storage
                        .from('rh-documents')
                        .createSignedUrl(doc.storage_path, 3600); // 3600 seconds = 1 hour

                    if (!urlError && signedUrlData) {
                        return { ...doc, url: signedUrlData.signedUrl };
                    }
                }
                return doc;
            })
        );

        res.json(documentsWithSignedUrls);
    } catch (error) {
        console.error('Erro ao listar documentos:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// POST /upload - Upload de documento
router.post('/upload', requirePermission('HR', 'upload_document'), upload.single('file'), async (req, res) => {
    try {
        const { employee_id, category, name, expiry_date, notes } = req.body;
        const file = req.file;

        if (!file || !employee_id || !category) {
            return res.status(400).json({ error: 'Arquivo, funcionário e categoria são obrigatórios' });
        }

        // 1. Upload para Supabase Storage
        const fileName = `${employee_id}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('rh-documents')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype
            });

        if (storageError) throw storageError;

        // 2. Save to Database (URL will be generated on-demand via signed URLs)
        const { data: docData, error: dbError } = await supabase
            .from('rh_documents')
            .insert([{
                employee_id,
                name: name || file.originalname,
                type: file.mimetype,
                url: null, // Will be generated as signed URL when listing documents
                storage_path: fileName,
                size: file.size,
                category,
                expiry_date: expiry_date || null,
                notes,
                uploaded_by: req.user.id
            }])
            .select()
            .single();

        if (dbError) throw dbError;

        res.status(201).json(docData);
    } catch (error) {
        console.error('Erro no upload:', error);
        res.status(500).json({ error: 'Erro interno no upload', details: error.message });
    }
});

// DELETE /:id - Remover documento
router.delete('/:id', requirePermission('HR', 'delete'), async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Buscar documento para pegar o path
        const { data: doc, error: fetchError } = await supabase
            .from('rh_documents')
            .select('storage_path')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Remover do Storage
        if (doc.storage_path) {
            await supabase.storage
                .from('rh-documents')
                .remove([doc.storage_path]);
        }

        // 3. Remover do Banco (Soft delete ou Hard delete)
        // Usando Hard delete por enquanto, ou update deleted_at se preferir soft
        const { error: deleteError } = await supabase
            .from('rh_documents')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({ message: 'Documento removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover documento:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
