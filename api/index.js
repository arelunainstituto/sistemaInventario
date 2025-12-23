// Polyfills for Node.js 16 environment
const nodeFetch = require('node-fetch');
global.Headers = nodeFetch.Headers;
global.Request = nodeFetch.Request;
global.Response = nodeFetch.Response;
global.fetch = nodeFetch;

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');
require('dotenv').config();

// Função para sanitizar nomes de arquivos
function sanitizeFileName(filename) {
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '');
}

const { createClient } = require('@supabase/supabase-js');
const { authenticateToken, requirePermission, requireRole, requireAdmin, getCurrentUser } = require('./middleware/auth');

// Importar módulo de Ordens de Serviço
const prostoralOrders = require('./prostoral-ordens');
const prostoralClients = require('./prostoral-clientes');

// Importar rotas de Token Exchange
const tokenExchangeRoutes = require('./routes/token-exchange');

// Importar rotas do módulo de RH
const rhRoutes = require('./rh');

const app = express();
const PORT = process.env.PORT || 3002;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Configuração do multer para upload de arquivos
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB - suporte para PDFs grandes
        fieldSize: 10 * 1024 * 1024, // 10MB para campos de texto
        fields: 50, // Máximo de 50 campos
        files: 15 // Máximo de 15 arquivos
    },
    fileFilter: (req, file, cb) => {
        console.log(`📁 Processando arquivo: ${file.originalname}, tipo: ${file.mimetype}, tamanho estimado: ${file.size || 'desconhecido'}`);
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos de imagem e PDF são permitidos'), false);
        }
    }
});

// Função para gerar QR Code único (mantida para compatibilidade)
function generateUniqueQRCode() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `QR-${timestamp}-${random}`;
}

// Função para gerar link do item
function generateItemLink(itemId, port = PORT) {
    // Sempre usar o domínio de produção
    return `https://erp.institutoareluna.pt/view-item.html?id=${itemId}`;
}

// Função para gerar QR Code como Data URL
async function generateQRCodeDataURL(text) {
    try {
        const qrCodeDataURL = await QRCode.toDataURL(text, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        return qrCodeDataURL;
    } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
        throw error;
    }
}

// Função para fazer upload de imagem para o Supabase Storage
async function uploadImageToStorage(file, fileName) {
    try {
        const { data, error } = await supabaseAdmin.storage
            .from('item-images')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            throw error;
        }

        // Obter URL pública da imagem
        const { data: publicUrlData } = supabaseAdmin.storage
            .from('item-images')
            .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('Erro ao fazer upload da imagem:', error);
        throw error;
    }
}

// Função para fazer upload de PDF para o Supabase Storage
async function uploadPdfToStorage(file, fileName) {
    try {
        const { data, error } = await supabaseAdmin.storage
            .from('item-pdfs')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            throw error;
        }

        // Obter URL pública do PDF
        const { data: publicUrlData } = supabaseAdmin.storage
            .from('item-pdfs')
            .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('Erro ao fazer upload do PDF:', error);
        throw error;
    }
}

// Middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdn.tailwindcss.com",
                "https://unpkg.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            connectSrc: [
                "'self'",
                "https://cdn.jsdelivr.net", // Allow Chart.js source maps
                process.env.SUPABASE_URL,
                process.env.SUPABASE_URL?.replace('https://', 'wss://') // WebSocket para Realtime
            ]
        }
    }
}));
// Configuração CORS para integração com múltiplos sistemas
const allowedOrigins = [
    'http://localhost:3002',
    'https://audio-ai-app.vercel.app',
    'http://127.0.0.1:3002',
    'https://erp.institutoareluna.pt',
    'https://*.vercel.app' // Permitir preview deployments do Vercel
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requisições sem origin (mobile apps, Postman)
        if (!origin) return callback(null, true);

        // Verificar se origin está na lista ou é um domínio Vercel
        if (allowedOrigins.some(allowed => {
            if (allowed.includes('*')) {
                const pattern = allowed.replace('*.', '');
                return origin.endsWith(pattern);
            }
            return origin === allowed;
        })) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS bloqueou origem: ${origin}`);
            callback(null, true); // Por enquanto permitir (em produção, use: callback(new Error('Not allowed by CORS')))
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));
app.use(compression());

// Middleware condicional para parsing JSON/URL - apenas para rotas que não usam multipart
app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';

    // Se não for multipart/form-data, aplicar parsing JSON/URL
    if (!contentType.includes('multipart/form-data')) {
        express.json({ limit: '10mb' })(req, res, (err) => {
            if (err) return next(err);
            express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
        });
    } else {
        // Para multipart, pular o parsing JSON/URL
        next();
    }
});

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Servir arquivos estáticos da pasta public (DEVE VIR ANTES DAS ROTAS DA API)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Endpoint para autenticação e informações do usuário
app.get('/api/auth/me', authenticateToken, getCurrentUser);

// Rotas de Token Exchange (autenticação segura cross-origin)
app.use('/api/auth', tokenExchangeRoutes);

// Rotas do Módulo de RH
app.use('/api/rh', rhRoutes);

// Rotas da API

// Get current user data (with roles and permissions)
app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        // req.user já contém os dados do usuário, roles e permissions
        // adicionados pelo authenticateToken middleware
        res.json({
            id: req.user.id,
            email: req.user.email,
            full_name: req.user.full_name,
            roles: req.user.roles || [],
            permissions: req.user.permissions || [],
            available_modules: req.user.available_modules || []
        });
    } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET -// Rota para listar todos os itens
app.get('/api/items', authenticateToken, requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const {
            search = '',
            category = '',
            status = '',
            priceMin = '',
            priceMax = '',
            stock = '',
            sortBy = 'created_at',
            sortOrder = 'desc',
            page = 1,
            limit = 100
        } = req.query;

        // Construir query base
        let query = supabase
            .from('sistemainventario')
            .select('*', { count: 'exact' })
            .eq('module_type', 'inventory');

        // Aplicar filtros de busca por texto
        if (search) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%,supplier.ilike.%${search}%`);
        }

        // Filtro por categoria
        if (category) {
            query = query.eq('category', category);
        }

        // Filtro por status
        if (status) {
            query = query.eq('status', status);
        }

        // Filtro por faixa de preço
        if (priceMin) {
            query = query.gte('price', parseFloat(priceMin));
        }
        if (priceMax) {
            query = query.lte('price', parseFloat(priceMax));
        }

        // Filtro por nível de estoque
        if (stock) {
            switch (stock) {
                case 'zero':
                    query = query.eq('quantity', 0);
                    break;
                case 'low':
                    query = query.gt('quantity', 0).lte('quantity', 10);
                    break;
                case 'medium':
                    query = query.gt('quantity', 10).lte('quantity', 50);
                    break;
                case 'high':
                    query = query.gt('quantity', 50);
                    break;
            }
        }

        // Ordenação
        const validSortFields = ['name', 'price', 'quantity', 'created_at', 'category', 'status'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const ascending = sortOrder === 'asc';
        query = query.order(sortField, { ascending });

        // Paginação
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(1000, Math.max(1, parseInt(limit))); // Máximo 1000 itens por página
        const offset = (pageNum - 1) * limitNum;

        query = query.range(offset, offset + limitNum - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('Erro ao buscar itens:', error);
            return res.status(500).json({
                error: 'Erro interno do servidor',
                details: error.message
            });
        }

        // Buscar categorias e colaboradores separadamente
        const categoryIds = [...new Set((data || []).map(item => item.categoria_id).filter(Boolean))];
        const collaboratorIds = [...new Set((data || []).map(item => item.colaborador_id).filter(Boolean))];

        let categories = {};
        let collaborators = {};

        if (categoryIds.length > 0) {
            const { data: categoryData, error: categoryError } = await supabase
                .from('categoriassistemainventario')
                .select('id, nome')
                .in('id', categoryIds);

            if (categoryError) {
                console.error('Erro ao buscar categorias:', categoryError);
            } else {
                categories = (categoryData || []).reduce((acc, cat) => {
                    acc[cat.id] = cat.nome;
                    return acc;
                }, {});
            }
        }

        if (collaboratorIds.length > 0) {
            const { data: collaboratorData } = await supabase
                .from('colaboradoressistemainventario')
                .select('id, nome')
                .in('id', collaboratorIds);

            collaborators = (collaboratorData || []).reduce((acc, col) => {
                acc[col.id] = col.nome;
                return acc;
            }, {});
        }

        // Calcular informações de paginação
        const totalPages = Math.ceil(count / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.json({
            success: true,
            data: (data || []).map(item => ({
                ...item,
                category: categories[item.categoria_id] || null,
                collaborator: collaborators[item.colaborador_id] || null
            })),
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: count,
                itemsPerPage: limitNum,
                hasNextPage,
                hasPrevPage
            },
            filters: {
                search,
                category,
                status,
                priceMin,
                priceMax,
                stock,
                sortBy: sortField,
                sortOrder
            }
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// GET - Buscar item por ID
app.get('/api/items/:id', authenticateToken, requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('sistemainventario')
            .select(`
                *,
                categoria:categoriassistemainventario(nome),
                colaborador:colaboradoressistemainventario(nome)
            `)
            .eq('module_type', 'inventory')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Item não encontrado'
                });
            }
            console.error('Erro ao buscar item:', error);
            return res.status(500).json({
                error: 'Erro interno do servidor',
                details: error.message
            });
        }

        // Transform the data to include category and collaborator names
        const transformedData = {
            ...data,
            category: data.categoria?.nome || null,
            collaborator: data.colaborador?.nome || null
        };

        res.json({
            success: true,
            data: transformedData
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// POST - Criar novo item
app.post('/api/items', authenticateToken, requirePermission('inventory', 'create'), upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'pdf', maxCount: 10 } // Permitir até 10 PDFs
]), async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            categoria_id,
            colaborador_id,
            company,
            location,
            status,
            value,
            brand,
            model,
            serial_number,
            purchase_date,
            warranty_date
        } = req.body;

        // Validação básica - agora aceita categoria_id ou category
        if (!name || (!categoria_id && !category) || !company || !status) {
            return res.status(400).json({
                error: 'Campos obrigatórios: name, categoria_id (ou category), company, status'
            });
        }

        let imageUrl = null;
        let pdfUrls = [];

        if (req.body.image_path) {
            const { data, error } = await supabase.storage.from('item-images').getPublicUrl(req.body.image_path);
            imageUrl = data.publicUrl;
            if (currentItem.module_data.image) {
                // Extrair o nome do arquivo da URL antiga
                const oldFileName = currentItem.module_data.image.split('/').pop();
                if (oldFileName) {
                    await supabase.storage
                        .from('item-images')
                        .remove([oldFileName]);
                }
            }
        }

        // Processar PDFs - pode vir como caminhos pré-enviados ou arquivos via multer
        console.log('=== DEBUG PDF PATHS (POST) ===');
        console.log('req.body:', req.body);
        console.log('req.body["pdf_paths[]"]:', req.body['pdf_paths[]']);
        console.log('req.body.pdf_paths:', req.body.pdf_paths);
        console.log('req.body.pdf_path:', req.body.pdf_path);
        console.log('req.files:', req.files);

        // Aceitar tanto pdf_paths[] quanto pdf_paths (com ou sem colchetes) e pdf_path (singular)
        const pdfPaths = req.body['pdf_paths[]'] || req.body.pdf_paths;
        const pdfPath = req.body.pdf_path;

        if (pdfPaths) {
            // Múltiplos PDFs já foram enviados para o Supabase Storage pelo frontend
            console.log('PDF paths (plural) encontrados:', pdfPaths);
            const paths = Array.isArray(pdfPaths) ? pdfPaths : [pdfPaths];
            const urls = paths.map(path => `${supabaseUrl}/storage/v1/object/public/item-pdfs/${path}`);
            pdfUrls.push(...urls);
            console.log('PDFs adicionados ao array:', urls);
        } else if (pdfPath) {
            // Um único PDF já foi enviado para o Supabase Storage pelo frontend
            console.log('PDF path (singular) encontrado:', pdfPath);
            const pdfUrl = `${supabaseUrl}/storage/v1/object/public/item-pdfs/${pdfPath}`;
            pdfUrls.push(pdfUrl);
            console.log('PDF adicionado ao array:', pdfUrl);
        } else if (req.files && req.files.pdf && req.files.pdf.length > 0) {
            // Fallback: upload tradicional via multer (ambiente local)
            console.log('Fazendo upload de PDFs via multer:', req.files.pdf.length);
            for (const pdfFile of req.files.pdf) {
                const sanitizedName = sanitizeFileName(pdfFile.originalname);
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;
                try {
                    const pdfUrl = await uploadPdfToStorage(pdfFile, fileName);
                    pdfUrls.push(pdfUrl);
                } catch (uploadError) {
                    console.error('Erro no upload do PDF:', uploadError);
                    return res.status(500).json({
                        error: 'Erro ao fazer upload do PDF',
                        details: uploadError.message
                    });
                }
            }
        }

        console.log('pdfUrls final:', pdfUrls);

        // Primeiro, criar o item sem o QR code
        const itemData = {
            name: name.trim(),
            description: description?.trim() || null,
            category: category?.trim() || null, // Manter para compatibilidade
            categoria_id: categoria_id || null,
            colaborador_id: colaborador_id || null,
            location: location?.trim() || null,
            status: status.trim(),
            module_type: 'inventory',
            data_type: 'item',
            pdfs: pdfUrls, // Novo campo para múltiplos PDFs
            module_data: {
                company: company.trim(),
                value: value ? parseFloat(value) : null,
                brand: brand?.trim() || null,
                model: model?.trim() || null,
                serial_number: serial_number?.trim() || null,
                purchase_date: purchase_date || null,
                warranty_date: warranty_date || null,
                image: imageUrl,
                pdf: pdfUrls.length > 0 ? pdfUrls[0] : null // Manter compatibilidade com PDF único
            },
            metadata: {
                created_by: 'system',
                source: 'api'
            }
        };

        console.log('Item data before insert:', JSON.stringify(itemData, null, 2));

        // Inserir o item primeiro para obter o ID
        const { data: insertedItem, error: insertError } = await supabase
            .from('sistemainventario')
            .insert([itemData])
            .select()
            .single();

        if (insertError) {
            console.error('Erro ao criar item:', insertError);
            return res.status(500).json({
                error: 'Erro ao criar item',
                details: insertError.message
            });
        }

        // Agora gerar o QR code com o link do item usando o ID real
        const itemLink = generateItemLink(insertedItem.id);
        console.log('Generated item link for QR Code:', itemLink);
        let qrCodeDataURL = null;

        try {
            qrCodeDataURL = await generateQRCodeDataURL(itemLink);
            console.log('Generated QR Code Data URL length:', qrCodeDataURL ? qrCodeDataURL.length : 'null');
        } catch (qrError) {
            console.error('Erro ao gerar QR Code:', qrError);
            // Se falhar ao gerar QR code, ainda retornamos o item criado
            console.warn('Item criado sem QR code devido ao erro:', qrError.message);
        }

        // Atualizar o item com o QR code se foi gerado com sucesso
        if (qrCodeDataURL) {
            const updatedModuleData = {
                ...insertedItem.module_data,
                qr_code: itemLink,
                qr_code_image: qrCodeDataURL
            };

            const { data: updatedItem, error: updateError } = await supabase
                .from('sistemainventario')
                .update({ module_data: updatedModuleData })
                .eq('id', insertedItem.id)
                .select()
                .single();

            if (updateError) {
                console.error('Erro ao atualizar item com QR code:', updateError);
                // Retornar o item original mesmo se a atualização do QR code falhar
                res.status(201).json({
                    success: true,
                    message: 'Item criado com sucesso (QR code não pôde ser adicionado)',
                    data: insertedItem
                });
                return;
            }

            res.status(201).json({
                success: true,
                message: 'Item criado com sucesso',
                data: updatedItem
            });
        } else {
            res.status(201).json({
                success: true,
                message: 'Item criado com sucesso (sem QR code)',
                data: insertedItem
            });
        }
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// PUT - Atualizar item
app.put('/api/items/:id', authenticateToken, requirePermission('inventory', 'manage'), upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'pdf', maxCount: 10 } // Permitir até 10 PDFs
]), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            category,
            company,
            location,
            status,
            value,
            brand,
            model,
            serial_number,
            purchase_date,
            warranty_date,
            categoria_id,
            colaborador_id
        } = req.body;

        // Debug logs
        console.log('PUT /api/items/:id - Dados recebidos:');
        console.log('Files:', req.files);
        console.log('Body:', req.body);
        console.log('PDFs recebidos:', req.files?.pdf?.length || 0);
        console.log('removePdfs recebido:', req.body.removePdfs);

        // Validação básica - agora aceita categoria_id ou category
        if (!name || (!categoria_id && !category) || !company || !status) {
            return res.status(400).json({
                error: 'Campos obrigatórios: name, categoria_id (ou category), company, status'
            });
        }

        // Buscar o item atual para obter a imagem e PDFs existentes
        const { data: currentItem, error: fetchError } = await supabase
            .from('sistemainventario')
            .select('module_data, pdfs')
            .eq('id', id)
            .eq('module_type', 'inventory')
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Item não encontrado'
                });
            }
            console.error('Erro ao buscar item:', fetchError);
            return res.status(500).json({
                error: 'Erro ao buscar item',
                details: fetchError.message
            });
        }

        let imageUrl = currentItem.module_data.image; // Manter imagem existente por padrão
        let pdfUrls = Array.isArray(currentItem.pdfs) ? [...currentItem.pdfs] : []; // Clonar array de PDFs existentes

        // Migrar PDF do campo antigo para o novo array se necessário
        if (pdfUrls.length === 0 && currentItem.module_data.pdf) {
            pdfUrls = [currentItem.module_data.pdf];
            console.log('Migrando PDF do campo antigo:', currentItem.module_data.pdf);
        }

        console.log('PDFs existentes no item:', pdfUrls);
        console.log('Tamanho inicial do array pdfUrls:', pdfUrls.length);

        // Se há uma nova imagem, fazer upload para o Supabase Storage
        /*if (req.files && req.files.image && req.files.image[0]) {
            const sanitizedName = sanitizeFileName(req.files.image[0].originalname);
            const fileName = `${Date.now()}-${sanitizedName}`;
            try {
                imageUrl = await uploadImageToStorage(req.files.image[0], fileName);
                console.log('Image URL after upload:', imageUrl);
                // Opcional: Remover imagem antiga do storage se existir
                if (currentItem.module_data.image) {
                    // Extrair o nome do arquivo da URL antiga
                    const oldFileName = currentItem.module_data.image.split('/').pop();
                    if (oldFileName) {
                        await supabase.storage
                            .from('item-images')
                            .remove([oldFileName]);
                    }
                }
            } catch (uploadError) {
                console.error('Erro no upload da imagem:', uploadError);
                return res.status(500).json({
                    error: 'Erro ao fazer upload da imagem',
                    details: uploadError.message
                });
            }
        }*/

        if (req.body.image_path) {
            const { data, error } = await supabase.storage.from('item-images').getPublicUrl(req.body.image_path);
            imageUrl = data.publicUrl;
            if (currentItem.module_data.image) {
                // Extrair o nome do arquivo da URL antiga
                const oldFileName = currentItem.module_data.image.split('/').pop();
                if (oldFileName) {
                    await supabase.storage
                        .from('item-images')
                        .remove([oldFileName]);
                }
            }
        }

        // Processar PDFs - pode vir como caminhos pré-enviados ou arquivos via multer
        console.log('=== DEBUG PDF PATHS (PUT) ===');
        console.log('req.body:', req.body);
        console.log('req.body["pdf_paths[]"]:', req.body['pdf_paths[]']);
        console.log('req.body.pdf_paths:', req.body.pdf_paths);
        console.log('req.body.pdf_path:', req.body.pdf_path);
        console.log('req.files:', req.files);
        console.log('req.files.pdf:', req.files ? req.files.pdf : 'undefined');

        // Aceitar tanto pdf_paths[] quanto pdf_paths (com ou sem colchetes) e pdf_path (singular)
        const pdfPaths = req.body['pdf_paths[]'] || req.body.pdf_paths;
        const pdfPath = req.body.pdf_path;

        if (pdfPaths) {
            // Múltiplos PDFs já foram enviados para o Supabase Storage pelo frontend
            console.log('Processando PDFs já enviados ao Storage (plural):', pdfPaths);
            const paths = Array.isArray(pdfPaths) ? pdfPaths : [pdfPaths];
            const newPdfUrls = paths.map(path => `${supabaseUrl}/storage/v1/object/public/item-pdfs/${path}`);
            pdfUrls.push(...newPdfUrls);
            console.log('PDFs adicionados ao array:', newPdfUrls);
        } else if (pdfPath) {
            // Um único PDF já foi enviado para o Supabase Storage pelo frontend
            console.log('Processando PDF já enviado ao Storage (singular):', pdfPath);
            const newPdfUrl = `${supabaseUrl}/storage/v1/object/public/item-pdfs/${pdfPath}`;
            pdfUrls.push(newPdfUrl);
            console.log('PDF adicionado ao array:', newPdfUrl);
        } else if (req.files && req.files.pdf && req.files.pdf.length > 0) {
            // Fallback: upload tradicional via multer (ambiente local)
            console.log('Fazendo upload de novos PDFs via multer:', req.files.pdf.length);
            console.log('Array pdfUrls antes do upload:', pdfUrls);
            for (const pdfFile of req.files.pdf) {
                const sanitizedName = sanitizeFileName(pdfFile.originalname);
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;
                try {
                    const newPdfUrl = await uploadPdfToStorage(pdfFile, fileName);
                    console.log('PDF uploaded:', newPdfUrl);
                    pdfUrls.push(newPdfUrl);
                    console.log('Array pdfUrls após adicionar PDF:', pdfUrls);
                } catch (uploadError) {
                    console.error('Erro no upload do PDF:', uploadError);
                    return res.status(500).json({
                        error: 'Erro ao fazer upload do PDF',
                        details: uploadError.message
                    });
                }
            }
            console.log('Array pdfUrls final após todos os uploads:', pdfUrls);
        }

        // Processar remoção de PDFs existentes se especificado
        const removePdfs = req.body.removePdfs ? JSON.parse(req.body.removePdfs) : [];
        console.log('PDFs para remover:', removePdfs);
        if (removePdfs.length > 0) {
            // Remover PDFs do storage
            for (const pdfUrl of removePdfs) {
                try {
                    const fileName = pdfUrl.split('/').pop();
                    if (fileName) {
                        await supabase.storage
                            .from('item-pdfs')
                            .remove([fileName]);
                        console.log('PDF removido do storage:', fileName);
                    }
                } catch (error) {
                    console.warn('Erro ao remover PDF do storage:', error);
                }
            }
            // Remover PDFs da lista
            pdfUrls = pdfUrls.filter(url => !removePdfs.includes(url));
            console.log('PDFs após remoção:', pdfUrls);
        }

        const itemData = {
            pdfs: pdfUrls, // Novo campo para múltiplos PDFs
            module_data: {
                name: name.trim(),
                description: description?.trim() || null,
                category: category?.trim() || null,
                company: company.trim(),
                location: location?.trim() || null,
                status: status.trim(),
                value: value ? parseFloat(value) : null,
                brand: brand?.trim() || null,
                model: model?.trim() || null,
                serial_number: serial_number?.trim() || null,
                purchase_date: purchase_date || null,
                warranty_date: warranty_date || null,
                image: imageUrl,
                pdf: pdfUrls.length > 0 ? pdfUrls[0] : null // Manter compatibilidade com PDF único
            },
            categoria_id: categoria_id || null,
            colaborador_id: colaborador_id || null,
            updated_at: new Date().toISOString()
        };

        console.log('Dados finais para atualização:', JSON.stringify(itemData, null, 2));

        const { data, error } = await supabase
            .from('sistemainventario')
            .update(itemData)
            .eq('id', id)
            .eq('module_type', 'inventory')
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Item não encontrado'
                });
            }
            console.error('Erro ao atualizar item:', error);
            return res.status(500).json({
                error: 'Erro ao atualizar item',
                details: error.message
            });
        }

        res.json({
            success: true,
            message: 'Item atualizado com sucesso',
            data: data
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// Função para excluir arquivo do Supabase Storage
async function deleteFileFromStorage(bucket, filePath) {
    try {
        if (!filePath) return { success: true };

        // Extrair apenas o nome do arquivo da URL
        const fileName = filePath.split('/').pop();

        const { error } = await supabase.storage
            .from(bucket)
            .remove([fileName]);

        if (error) {
            console.error(`Erro ao excluir arquivo ${fileName} do bucket ${bucket}:`, error);
            return { success: false, error };
        }

        console.log(`Arquivo ${fileName} excluído com sucesso do bucket ${bucket}`);
        return { success: true };
    } catch (error) {
        console.error('Erro inesperado ao excluir arquivo:', error);
        return { success: false, error };
    }
}

// DELETE - Excluir item
app.delete('/api/items/:id', authenticateToken, requirePermission('inventory', 'delete'), async (req, res) => {
    try {
        const { id } = req.params;

        // Primeiro, buscar os dados do item para obter URLs dos arquivos
        const { data: item, error: fetchError } = await supabase
            .from('sistemainventario')
            .select('*')
            .eq('id', id)
            .eq('module_type', 'inventory')
            .single();

        if (fetchError) {
            console.error('Erro ao buscar item:', fetchError);
            return res.status(404).json({
                error: 'Item não encontrado',
                details: fetchError.message
            });
        }

        // Excluir arquivos associados se existirem
        const deletePromises = [];

        if (item.module_data && item.module_data.image) {
            deletePromises.push(deleteFileFromStorage('item-images', item.module_data.image));
        }

        if (item.module_data && item.module_data.pdf) {
            deletePromises.push(deleteFileFromStorage('item-pdfs', item.module_data.pdf));
        }

        // Aguardar exclusão dos arquivos (não bloquear se houver erro)
        if (deletePromises.length > 0) {
            const results = await Promise.allSettled(deletePromises);
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Erro ao excluir arquivo ${index}:`, result.reason);
                }
            });
        }

        // Excluir o registro do banco de dados
        const { error } = await supabase
            .from('sistemainventario')
            .delete()
            .eq('id', id)
            .eq('module_type', 'inventory');

        if (error) {
            console.error('Erro ao excluir item:', error);
            return res.status(500).json({
                error: 'Erro ao excluir item',
                details: error.message
            });
        }

        res.json({
            success: true,
            message: 'Item e arquivos associados excluídos com sucesso'
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// GET - Estatísticas do inventário
app.get('/api/stats', authenticateToken, requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('sistemainventario')
            .select('module_data')
            .eq('module_type', 'inventory');

        if (error) {
            console.error('Erro ao buscar estatísticas:', error);
            return res.status(500).json({
                error: 'Erro interno do servidor',
                details: error.message
            });
        }

        const stats = {
            total: data.length,
            byCategory: {},
            byStatus: {},
            byCompany: {},
            activeItems: data.filter(item => item.module_data?.status === 'ativo').length
        };

        // Contar por categoria
        data.forEach(item => {
            const moduleData = item.module_data || {};
            if (moduleData.category) {
                stats.byCategory[moduleData.category] = (stats.byCategory[moduleData.category] || 0) + 1;
            }
            if (moduleData.status) {
                stats.byStatus[moduleData.status] = (stats.byStatus[moduleData.status] || 0) + 1;
            }
            if (moduleData.company) {
                stats.byCompany[moduleData.company] = (stats.byCompany[moduleData.company] || 0) + 1;
            }
        });

        res.json({
            success: true,
            data: stats
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// GET - Buscar itens com filtros
app.get('/api/search', authenticateToken, requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { q, category, company, status } = req.query;

        let query = supabase.from('sistemainventario')
            .select('*')
            .eq('module_type', 'inventory');

        // Aplicar filtros
        if (category && category !== '') {
            query = query.eq('module_data->>category', category);
        }

        if (company && company !== '') {
            query = query.eq('module_data->>company', company);
        }

        if (status && status !== '') {
            query = query.eq('module_data->>status', status);
        }

        // Busca textual
        if (q && q.trim() !== '') {
            query = query.or(`module_data->>name.ilike.%${q}%,module_data->>description.ilike.%${q}%,module_data->>brand.ilike.%${q}%,module_data->>model.ilike.%${q}%,module_data->>serial_number.ilike.%${q}%`);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Erro na busca:', error);
            return res.status(500).json({
                error: 'Erro interno do servidor',
                details: error.message
            });
        }

        res.json({
            success: true,
            data: data || [],
            count: data ? data.length : 0
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// ===== ROTAS PARA CATEGORIAS =====

// GET - Listar todas as categorias
app.get('/api/categories', authenticateToken, requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('categoriassistemainventario')
            .select('*')
            .eq('ativo', true)
            .order('nome', { ascending: true });

        if (error) {
            console.error('Erro ao buscar categorias:', error);
            return res.status(500).json({
                error: 'Erro interno do servidor',
                details: error.message
            });
        }

        res.json({
            success: true,
            data: data || []
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// POST - Criar nova categoria
app.post('/api/categories', authenticateToken, requirePermission('inventory', 'manage'), async (req, res) => {
    try {
        const { nome } = req.body;

        if (!nome || !nome.trim()) {
            return res.status(400).json({
                error: 'Nome da categoria é obrigatório'
            });
        }

        const { data, error } = await supabase
            .from('categoriassistemainventario')
            .insert([{ nome: nome.trim() }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({
                    error: 'Categoria já existe'
                });
            }
            console.error('Erro ao criar categoria:', error);
            return res.status(500).json({
                error: 'Erro ao criar categoria',
                details: error.message
            });
        }

        res.status(201).json({
            success: true,
            data: data
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// ===== ROTAS PARA COLABORADORES =====

// GET - Listar todos os colaboradores
app.get('/api/collaborators', authenticateToken, requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('colaboradoressistemainventario')
            .select('*')
            .eq('ativo', true)
            .order('nome', { ascending: true });

        if (error) {
            console.error('Erro ao buscar colaboradores:', error);
            return res.status(500).json({
                error: 'Erro interno do servidor',
                details: error.message
            });
        }

        res.json({
            success: true,
            data: data || []
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// POST - Criar novo colaborador
app.post('/api/collaborators', authenticateToken, requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { nome, email, cargo } = req.body;

        if (!nome || !nome.trim()) {
            return res.status(400).json({
                error: 'Nome do colaborador é obrigatório'
            });
        }

        const collaboratorData = {
            nome: nome.trim(),
            email: email?.trim() || null,
            cargo: cargo?.trim() || null
        };

        const { data, error } = await supabase
            .from('colaboradoressistemainventario')
            .insert([collaboratorData])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(409).json({
                    error: 'Colaborador já existe'
                });
            }
            console.error('Erro ao criar colaborador:', error);
            return res.status(500).json({
                error: 'Erro ao criar colaborador',
                details: error.message
            });
        }

        res.status(201).json({
            success: true,
            data: data
        });
    } catch (err) {
        console.error('Erro inesperado:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// Endpoint para atualizar QR codes existentes
// Endpoint para gerar QR code para um item específico
app.post('/api/items/:id/generate-qr', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔄 Gerando QR code para o item ${id}...`);

        // Buscar o item específico
        const { data: item, error: fetchError } = await supabase
            .from('sistemainventario')
            .select('*')
            .eq('id', id)
            .eq('module_type', 'inventory')
            .single();

        if (fetchError) {
            console.error('Erro ao buscar item:', fetchError);
            return res.status(404).json({
                error: 'Item não encontrado',
                details: fetchError.message
            });
        }

        if (!item) {
            return res.status(404).json({
                error: 'Item não encontrado'
            });
        }

        // Gerar novo link e QR code
        const itemLink = generateItemLink(item.id);
        const newQRCodeDataURL = await generateQRCodeDataURL(itemLink);

        // Atualizar o item no banco
        const updatedModuleData = {
            ...item.module_data,
            qr_code: itemLink,
            qr_code_image: newQRCodeDataURL
        };

        const { error: updateError } = await supabase
            .from('sistemainventario')
            .update({
                module_data: updatedModuleData,
                updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

        if (updateError) {
            console.error(`❌ Erro ao atualizar item ${item.id}:`, updateError);
            return res.status(500).json({
                error: 'Erro ao atualizar item',
                details: updateError.message
            });
        }

        console.log(`✅ QR code gerado com sucesso para o item ${item.id}`);

        res.json({
            success: true,
            message: 'QR code gerado com sucesso',
            item: {
                id: item.id,
                qr_code: itemLink,
                qr_code_image: newQRCodeDataURL
            }
        });

    } catch (err) {
        console.error('❌ Erro inesperado ao gerar QR code:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

app.post('/api/update-qr-codes', async (req, res) => {
    try {
        console.log('🔄 Iniciando atualização dos QR codes...');

        // Buscar todos os itens que possuem QR codes
        const { data: items, error: fetchError } = await supabase
            .from('sistemainventario')
            .select('*')
            .eq('module_type', 'inventory')
            .not('module_data->qr_code', 'is', null);

        if (fetchError) {
            console.error('Erro ao buscar itens:', fetchError);
            return res.status(500).json({
                error: 'Erro ao buscar itens',
                details: fetchError.message
            });
        }

        if (!items || items.length === 0) {
            return res.json({
                success: true,
                message: 'Nenhum item com QR code encontrado',
                updated: 0
            });
        }

        console.log(`📋 Encontrados ${items.length} itens com QR codes`);

        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const item of items) {
            try {
                const currentQRCode = item.module_data?.qr_code;

                // Verificar se o QR code já está no formato correto (contém URL)
                if (currentQRCode && currentQRCode.includes('view-item.html')) {
                    console.log(`⏭️  Item ${item.id} já possui QR code atualizado`);
                    skippedCount++;
                    continue;
                }

                // Gerar novo link e QR code
                const itemLink = generateItemLink(item.id);
                const newQRCodeDataURL = await generateQRCodeDataURL(itemLink);

                // Atualizar o item no banco
                const updatedModuleData = {
                    ...item.module_data,
                    qr_code: itemLink,
                    qr_code_image: newQRCodeDataURL
                };

                const { error: updateError } = await supabase
                    .from('sistemainventario')
                    .update({
                        module_data: updatedModuleData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', item.id);

                if (updateError) {
                    console.error(`❌ Erro ao atualizar item ${item.id}:`, updateError);
                    errors.push(`Item ${item.id}: ${updateError.message}`);
                } else {
                    console.log(`✅ Item ${item.id} atualizado com sucesso`);
                    updatedCount++;
                }

            } catch (itemError) {
                console.error(`❌ Erro ao processar item ${item.id}:`, itemError);
                errors.push(`Item ${item.id}: ${itemError.message}`);
            }
        }

        const result = {
            success: true,
            message: `Atualização concluída: ${updatedCount} atualizados, ${skippedCount} já estavam corretos`,
            updated: updatedCount,
            skipped: skippedCount,
            total: items.length
        };

        if (errors.length > 0) {
            result.errors = errors;
            result.hasErrors = true;
        }

        console.log('🎉 Atualização dos QR codes concluída:', result);
        res.json(result);

    } catch (err) {
        console.error('❌ Erro inesperado na atualização dos QR codes:', err);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: err.message
        });
    }
});

// ========== PRINT QUEUE API ENDPOINTS ==========

// Endpoint para adicionar item à fila de impressão
app.post('/api/print/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const { priority = 1, qrCodeSize = '25mm' } = req.body;

        // Buscar dados do item
        const { data: item, error: itemError } = await supabase
            .from('sistemainventario')
            .select('*')
            .eq('id', itemId)
            .eq('module_type', 'inventory')
            .single();

        if (itemError || !item) {
            return res.status(404).json({
                success: false,
                error: 'Item não encontrado'
            });
        }

        // Verificar se já existe um job pendente para este item
        const { data: existingJob } = await supabase
            .from('print_queue')
            .select('id')
            .eq('item_id', itemId)
            .eq('status', 'pending')
            .single();

        if (existingJob) {
            return res.json({
                success: true,
                message: 'Item já está na fila de impressão',
                job_id: existingJob.id
            });
        }

        // Gerar URL simples para o QR code
        const itemUrl = generateItemLink(itemId);

        // Adicionar à fila de impressão
        const { data: printJob, error: printError } = await supabase
            .from('print_queue')
            .insert({
                item_id: itemId,
                qr_code_data: itemUrl, // Usar URL simples em vez da imagem base64
                item_name: item.name || item.module_data?.name,
                item_code: item.code || item.id,
                priority: priority,
                status: 'pending',
                qr_code_size: qrCodeSize // Adicionar o tamanho do QR code
            })
            .select()
            .single();

        if (printError) {
            console.error('Erro ao adicionar à fila de impressão:', printError);
            return res.status(500).json({
                success: false,
                error: 'Erro ao adicionar à fila de impressão',
                details: printError.message
            });
        }

        console.log(`Item ${item.name || item.module_data?.name} adicionado à fila de impressão com tamanho QR: ${qrCodeSize}`);

        res.json({
            success: true,
            message: 'Item enviado para impressão',
            job_id: printJob.id,
            item_name: item.name || item.module_data?.name,
            qr_code_size: qrCodeSize
        });

    } catch (error) {
        console.error('Erro no endpoint de impressão:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Endpoint para consultar status da fila de impressão
app.get('/api/print-status', async (req, res) => {
    try {
        const { job_id, item_id, status } = req.query;

        let query = supabase.from('print_queue').select('*');

        if (job_id) {
            query = query.eq('id', job_id);
        } else if (item_id) {
            query = query.eq('item_id', item_id);
        } else if (status) {
            query = query.eq('status', status);
        }

        query = query.order('created_at', { ascending: false });

        const { data: jobs, error } = await query;

        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Erro ao consultar fila de impressão',
                details: error.message
            });
        }

        res.json({
            success: true,
            jobs: jobs || []
        });

    } catch (error) {
        console.error('Erro ao consultar status da impressão:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Endpoint para atualizar status de job de impressão (usado pelo agente local)
app.put('/api/print-status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status, error_message } = req.body;

        const updateData = {
            status,
            ...(status === 'printing' && { started_at: new Date().toISOString() }),
            ...(status === 'completed' && { completed_at: new Date().toISOString() }),
            ...(status === 'failed' && { error_message })
        };

        const { data, error } = await supabase
            .from('print_queue')
            .update(updateData)
            .eq('id', jobId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Erro ao atualizar status',
                details: error.message
            });
        }

        console.log(`Status do job ${jobId} atualizado para: ${status}`);

        res.json({
            success: true,
            job: data
        });

    } catch (error) {
        console.error('Erro ao atualizar status do job:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Endpoint para monitorar status de impressão em tempo real (Server-Sent Events)
app.get('/api/print-status/stream/:jobId', async (req, res) => {
    const { jobId } = req.params;

    // Configurar headers para Server-Sent Events
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
        // Enviar status inicial
        const { data: initialJob, error: initialError } = await supabase
            .from('print_queue')
            .select('*')
            .eq('id', jobId)
            .single();

        if (initialError) {
            res.write(`data: ${JSON.stringify({ error: 'Job não encontrado' })}\n\n`);
            res.end();
            return;
        }

        res.write(`data: ${JSON.stringify(initialJob)}\n\n`);

        // Se o job já está completo ou falhou, encerrar stream
        if (initialJob.status === 'completed' || initialJob.status === 'failed') {
            res.end();
            return;
        }

        // Configurar subscription para mudanças no job específico
        const subscription = supabase
            .channel(`print_job_${jobId}`)
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'print_queue',
                    filter: `id=eq.${jobId}`
                },
                (payload) => {
                    res.write(`data: ${JSON.stringify(payload.new)}\n\n`);

                    // Encerrar stream se job completou ou falhou
                    if (payload.new.status === 'completed' || payload.new.status === 'failed') {
                        subscription.unsubscribe();
                        res.end();
                    }
                }
            )
            .subscribe();

        // Cleanup quando cliente desconectar
        req.on('close', () => {
            subscription.unsubscribe();
            res.end();
        });

        // Timeout após 5 minutos
        setTimeout(() => {
            subscription.unsubscribe();
            res.end();
        }, 5 * 60 * 1000);

    } catch (error) {
        console.error('Erro no stream de status:', error);
        res.write(`data: ${JSON.stringify({ error: 'Erro interno do servidor' })}\n\n`);
        res.end();
    }
});

// Endpoint para obter histórico de impressões
app.get('/api/print-history', async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('print_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data: jobs, error } = await query;

        if (error) {
            throw error;
        }

        // Contar total de registros
        let countQuery = supabase
            .from('print_queue')
            .select('*', { count: 'exact', head: true });

        if (status) {
            countQuery = countQuery.eq('status', status);
        }

        const { count, error: countError } = await countQuery;

        if (countError) {
            throw countError;
        }

        res.json({
            success: true,
            data: jobs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao buscar histórico de impressões:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar histórico de impressões'
        });
    }
});

// Endpoint para estatísticas de impressão
app.get('/api/print-stats', async (req, res) => {
    try {
        const { data: stats, error } = await supabase
            .from('print_queue')
            .select('status')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Últimas 24h

        if (error) {
            throw error;
        }

        const statusCount = stats.reduce((acc, job) => {
            acc[job.status] = (acc[job.status] || 0) + 1;
            return acc;
        }, {});

        // Buscar total geral
        const { count: totalJobs, error: totalError } = await supabase
            .from('print_queue')
            .select('*', { count: 'exact', head: true });

        if (totalError) {
            throw totalError;
        }

        res.json({
            success: true,
            data: {
                last24h: statusCount,
                total: totalJobs,
                pending: statusCount.pending || 0,
                processing: statusCount.processing || 0,
                completed: statusCount.completed || 0,
                failed: statusCount.failed || 0
            }
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas de impressão:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar estatísticas de impressão'
        });
    }
});

// Endpoint para cancelar job de impressão
app.post('/api/print-cancel/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;

        // Verificar se o job existe e pode ser cancelado
        const { data: job, error: fetchError } = await supabase
            .from('print_queue')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError || !job) {
            return res.status(404).json({
                success: false,
                error: 'Job não encontrado'
            });
        }

        // Verificar se o job pode ser cancelado (apenas pending ou processing)
        if (!['pending', 'processing'].includes(job.status)) {
            return res.status(400).json({
                success: false,
                error: `Job não pode ser cancelado. Status atual: ${job.status}`
            });
        }

        // Atualizar status para cancelled
        const { data: updatedJob, error: updateError } = await supabase
            .from('print_queue')
            .update({
                status: 'failed',
                error_message: 'Cancelado pelo usuário',
                updated_at: new Date().toISOString()
            })
            .eq('id', jobId)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json({
                success: false,
                error: 'Erro ao cancelar job',
                details: updateError.message
            });
        }

        console.log(`Job ${jobId} cancelado pelo usuário`);

        res.json({
            success: true,
            message: 'Job cancelado com sucesso',
            job: updatedJob
        });

    } catch (error) {
        console.error('Erro ao cancelar job:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Endpoint para limpar jobs antigos da fila
app.delete('/api/print-cleanup', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

        const { data, error } = await supabase
            .from('print_queue')
            .delete()
            .in('status', ['completed', 'failed'])
            .lt('created_at', cutoffDate.toISOString())
            .select();

        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Erro ao limpar fila',
                details: error.message
            });
        }

        res.json({
            success: true,
            message: `${data?.length || 0} jobs antigos removidos da fila`
        });

    } catch (error) {
        console.error('Erro ao limpar fila:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message
        });
    }
});

// Endpoint para criar a tabela print_queue
app.post('/api/setup-print-table', async (req, res) => {
    try {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS print_queue (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                item_id UUID NOT NULL,
                qr_code_data TEXT NOT NULL,
                item_name TEXT NOT NULL,
                item_code TEXT,
                priority INTEGER DEFAULT 1,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                qr_code_size TEXT DEFAULT '128px' CHECK (qr_code_size IN ('10px', '25px', '50px', '75px', '128px')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                processed_at TIMESTAMP WITH TIME ZONE
            );

            -- Adicionar coluna qr_code_size se não existir
            ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS qr_code_size TEXT DEFAULT '128px' CHECK (qr_code_size IN ('10px', '25px', '50px', '75px', '128px'));

            -- Criar índices para melhor performance
            CREATE INDEX IF NOT EXISTS idx_print_queue_status ON print_queue(status);
            CREATE INDEX IF NOT EXISTS idx_print_queue_created_at ON print_queue(created_at);
            CREATE INDEX IF NOT EXISTS idx_print_queue_item_id ON print_queue(item_id);

            -- Habilitar RLS (Row Level Security)
            ALTER TABLE print_queue ENABLE ROW LEVEL SECURITY;

            -- Criar política para permitir acesso completo ao service role
            DROP POLICY IF EXISTS "Enable all access for service role" ON print_queue;
            CREATE POLICY "Enable all access for service role" ON print_queue
                FOR ALL USING (true);
        `;

        // Executar o SQL usando o service role
        const { data, error } = await supabaseAdmin.rpc('exec_sql', {
            sql: createTableSQL
        });

        if (error) {
            // Se a função exec_sql não existir, tentar criar a tabela diretamente
            console.log('Tentando criar tabela usando método alternativo...');

            // Usar uma abordagem mais simples
            const { error: tableError } = await supabaseAdmin
                .from('print_queue')
                .select('id')
                .limit(1);

            if (tableError && tableError.code === '42P01') {
                // Tabela não existe, retornar instruções para criação manual
                return res.json({
                    success: false,
                    message: 'Tabela print_queue não existe. Execute o SQL manualmente no Supabase Dashboard.',
                    sql: createTableSQL,
                    instructions: [
                        '1. Acesse o Supabase Dashboard',
                        '2. Vá para SQL Editor',
                        '3. Execute o SQL fornecido',
                        '4. Tente novamente este endpoint'
                    ]
                });
            }
        }

        res.json({
            success: true,
            message: 'Tabela print_queue criada com sucesso!',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro ao criar tabela print_queue:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            details: error.message,
            sql: `
                CREATE TABLE IF NOT EXISTS print_queue (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    item_id UUID NOT NULL,
                    qr_code_data TEXT NOT NULL,
                    item_name TEXT NOT NULL,
                    item_code TEXT,
                    priority INTEGER DEFAULT 1,
                    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
                    error_message TEXT,
                    retry_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    processed_at TIMESTAMP WITH TIME ZONE
                );
            `
        });
    }
});

// =====================================================
// ENDPOINTS DE MÓDULOS DO ERP
// =====================================================

// GET - Listar todos os módulos disponíveis no sistema
app.get('/api/modules', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modules')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) {
            console.error('Erro ao buscar módulos:', error);
            return res.status(500).json({ error: 'Erro ao buscar módulos' });
        }

        res.json({ success: true, modules: data });
    } catch (error) {
        console.error('Erro ao buscar módulos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET - Listar módulos acessíveis pelo usuário atual
app.get('/api/modules/available', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Usar a função SQL para obter módulos acessíveis
        const { data, error } = await supabaseAdmin.rpc('get_user_accessible_modules', {
            p_user_id: userId
        });

        if (error) {
            console.error('Erro ao buscar módulos acessíveis:', error);
            return res.status(500).json({ error: 'Erro ao buscar módulos acessíveis' });
        }

        res.json({ success: true, modules: data || [] });
    } catch (error) {
        console.error('Erro ao buscar módulos acessíveis:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET - Verificar se usuário tem acesso a um módulo específico
app.get('/api/modules/:moduleCode/check-access', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { moduleCode } = req.params;

        const { data, error } = await supabaseAdmin.rpc('user_has_module_access', {
            p_user_id: userId,
            p_module_code: moduleCode
        });

        if (error) {
            console.error('Erro ao verificar acesso ao módulo:', error);
            return res.status(500).json({ error: 'Erro ao verificar acesso' });
        }

        res.json({ success: true, hasAccess: data });
    } catch (error) {
        console.error('Erro ao verificar acesso ao módulo:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST - Criar novo módulo (apenas admin)
app.post('/api/modules', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { code, name, description, icon, emoji, color, route, display_order } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: 'Código e nome são obrigatórios' });
        }

        const { data, error } = await supabaseAdmin
            .from('modules')
            .insert([{
                code,
                name,
                description,
                icon,
                emoji,
                color,
                route,
                display_order: display_order || 0
            }])
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar módulo:', error);
            return res.status(500).json({ error: 'Erro ao criar módulo' });
        }

        res.json({ success: true, module: data });
    } catch (error) {
        console.error('Erro ao criar módulo:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// PUT - Atualizar módulo (apenas admin)
app.put('/api/modules/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon, emoji, color, route, display_order, is_active } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (icon !== undefined) updateData.icon = icon;
        if (emoji !== undefined) updateData.emoji = emoji;
        if (color !== undefined) updateData.color = color;
        if (route !== undefined) updateData.route = route;
        if (display_order !== undefined) updateData.display_order = display_order;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabaseAdmin
            .from('modules')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar módulo:', error);
            return res.status(500).json({ error: 'Erro ao atualizar módulo' });
        }

        res.json({ success: true, module: data });
    } catch (error) {
        console.error('Erro ao atualizar módulo:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE - Deletar módulo (apenas admin)
app.delete('/api/modules/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('modules')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao deletar módulo:', error);
            return res.status(500).json({ error: 'Erro ao deletar módulo' });
        }

        res.json({ success: true, message: 'Módulo deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar módulo:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// =====================================================
// ENDPOINTS DE GERENCIAMENTO DE ACESSO A MÓDULOS
// =====================================================

// GET - Listar acessos de um usuário específico (apenas admin)
app.get('/api/modules/access/user/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabaseAdmin
            .from('user_module_access')
            .select(`
                *,
                modules (
                    id,
                    code,
                    name,
                    icon,
                    emoji,
                    color
                )
            `)
            .eq('user_id', userId)
            .eq('is_active', true);

        if (error) {
            console.error('Erro ao buscar acessos do usuário:', error);
            return res.status(500).json({ error: 'Erro ao buscar acessos' });
        }

        res.json({ success: true, accesses: data });
    } catch (error) {
        console.error('Erro ao buscar acessos do usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST - Conceder acesso a módulo para usuário (apenas admin)
app.post('/api/modules/access/grant', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { user_id, module_id, expires_at } = req.body;
        const grantedBy = req.user.id;

        if (!user_id || !module_id) {
            return res.status(400).json({ error: 'user_id e module_id são obrigatórios' });
        }

        // Verificar se o acesso já existe
        const { data: existing } = await supabaseAdmin
            .from('user_module_access')
            .select('id')
            .eq('user_id', user_id)
            .eq('module_id', module_id)
            .single();

        if (existing) {
            // Atualizar acesso existente
            const { data, error } = await supabaseAdmin
                .from('user_module_access')
                .update({
                    is_active: true,
                    granted_by: grantedBy,
                    granted_at: new Date().toISOString(),
                    expires_at: expires_at || null
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) {
                console.error('Erro ao atualizar acesso:', error);
                return res.status(500).json({ error: 'Erro ao atualizar acesso' });
            }

            return res.json({ success: true, access: data, message: 'Acesso atualizado com sucesso' });
        }

        // Criar novo acesso
        const { data, error } = await supabaseAdmin
            .from('user_module_access')
            .insert([{
                user_id,
                module_id,
                granted_by: grantedBy,
                expires_at: expires_at || null
            }])
            .select()
            .single();

        if (error) {
            console.error('Erro ao conceder acesso:', error);
            return res.status(500).json({ error: 'Erro ao conceder acesso' });
        }

        res.json({ success: true, access: data, message: 'Acesso concedido com sucesso' });
    } catch (error) {
        console.error('Erro ao conceder acesso:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// DELETE - Revogar acesso a módulo (apenas admin)
app.delete('/api/modules/access/revoke', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { user_id, module_id } = req.body;

        if (!user_id || !module_id) {
            return res.status(400).json({ error: 'user_id e module_id são obrigatórios' });
        }

        const { error } = await supabaseAdmin
            .from('user_module_access')
            .update({ is_active: false })
            .eq('user_id', user_id)
            .eq('module_id', module_id);

        if (error) {
            console.error('Erro ao revogar acesso:', error);
            return res.status(500).json({ error: 'Erro ao revogar acesso' });
        }

        res.json({ success: true, message: 'Acesso revogado com sucesso' });
    } catch (error) {
        console.error('Erro ao revogar acesso:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET - Listar todos os usuários com seus acessos (apenas admin)
app.get('/api/modules/access/all-users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Buscar todos os perfis de usuários
        const { data: profiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('id, email, full_name')
            .order('full_name');

        if (profilesError) {
            console.error('Erro ao buscar perfis:', profilesError);
            return res.status(500).json({ error: 'Erro ao buscar usuários' });
        }

        // Buscar acessos de cada usuário
        const usersWithAccess = await Promise.all(
            profiles.map(async (profile) => {
                const { data: accesses } = await supabaseAdmin
                    .from('user_module_access')
                    .select(`
                        *,
                        modules (
                            id,
                            code,
                            name,
                            icon,
                            emoji,
                            color
                        )
                    `)
                    .eq('user_id', profile.id)
                    .eq('is_active', true);

                return {
                    ...profile,
                    module_accesses: accesses || []
                };
            })
        );

        res.json({ success: true, users: usersWithAccess });
    } catch (error) {
        console.error('Erro ao buscar usuários com acessos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});


// Middleware para capturar erros do multer
app.use((error, req, res, next) => {
    console.log('🚨 Erro capturado no middleware:', {
        name: error.name,
        message: error.message,
        code: error.code,
        type: error.type,
        field: error.field,
        stack: error.stack?.substring(0, 500)
    });

    if (error instanceof multer.MulterError) {
        console.log('📁 Erro específico do Multer:', {
            code: error.code,
            field: error.field,
            message: error.message
        });

        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(413).json({
                    error: 'Arquivo muito grande',
                    details: `Tamanho máximo permitido: 10MB`
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(413).json({
                    error: 'Muitos arquivos',
                    details: 'Máximo de 15 arquivos permitidos'
                });
            case 'LIMIT_FIELD_COUNT':
                return res.status(413).json({
                    error: 'Muitos campos',
                    details: 'Máximo de 50 campos permitidos'
                });
            case 'LIMIT_FIELD_SIZE':
                return res.status(413).json({
                    error: 'Campo muito grande',
                    details: 'Tamanho máximo do campo: 10MB'
                });
            default:
                return res.status(400).json({
                    error: 'Erro no upload',
                    details: error.message
                });
        }
    }

    if (error.type === 'entity.parse.failed') {
        console.log('🔍 Erro de parsing detectado:', {
            message: error.message,
            body: req.body ? 'Body presente' : 'Body ausente',
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length']
        });

        return res.status(400).json({
            error: 'Erro ao processar dados',
            details: 'Falha no parsing dos dados enviados. Verifique o formato dos arquivos.'
        });
    }

    next(error);
});

// Rota principal - servir dashboard.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// =====================================================
// PROSTORAL - API ENDPOINTS
// =====================================================

// ==================== CLIENTES ====================

// IMPORTANTE: Rotas específicas devem vir ANTES das rotas com parâmetros dinâmicos

// Rotas para gerenciamento de clientes (admin) - DEVEM VIR ANTES de /:id
app.get('/api/prostoral/clients/all', authenticateToken, prostoralClients.getAllClients);
app.get('/api/prostoral/clients/by-user/:userId', authenticateToken, prostoralClients.getClientByUser);

// GET - Listar todos os clientes
app.get('/api/prostoral/clients', authenticateToken, async (req, res) => {
    try {
        const { search, is_active } = req.query;

        let query = supabaseAdmin
            .from('prostoral_clients')
            .select('*')
            .order('name', { ascending: true });

        if (search) {
            query = query.or(`name.ilike.%${search}%,clinic_name.ilike.%${search}%,dentist_name.ilike.%${search}%`);
        }

        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, clients: data });
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Buscar cliente por ID
app.get('/api/prostoral/clients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('prostoral_clients')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({ success: true, client: data });
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Criar novo cliente
app.post('/api/prostoral/clients', authenticateToken, async (req, res) => {
    try {
        const clientData = {
            ...req.body,
            tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002',
            created_by: req.user.id
        };

        const { data, error } = await supabaseAdmin
            .from('prostoral_clients')
            .insert([clientData])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, client: data });
    } catch (error) {
        console.error('Erro ao criar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT - Atualizar cliente
app.put('/api/prostoral/clients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const clientData = {
            ...req.body,
            updated_by: req.user.id
        };

        const { data, error } = await supabaseAdmin
            .from('prostoral_clients')
            .update(clientData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, client: data });
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Desativar cliente
app.delete('/api/prostoral/clients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('prostoral_clients')
            .update({ is_active: false })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, client: data });
    } catch (error) {
        console.error('Erro ao desativar cliente:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Estatísticas do cliente
app.get('/api/prostoral/clients/:id/stats', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .rpc('get_client_statistics', { p_client_id: id });

        if (error) throw error;

        res.json({ success: true, stats: data[0] });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ESTOQUE ====================

// GET - Listar estoque
app.get('/api/prostoral/inventory', authenticateToken, async (req, res) => {
    try {
        const { category, search, low_stock } = req.query;

        let query = supabaseAdmin
            .from('prostoral_inventory')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (category) {
            query = query.eq('category', category);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,description.ilike.%${search}%`);
        }

        if (low_stock === 'true') {
            query = query.filter('quantity', 'lte', 'min_stock');
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, items: data });
    } catch (error) {
        console.error('Erro ao buscar estoque:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Adicionar item ao estoque
app.post('/api/prostoral/inventory', authenticateToken, async (req, res) => {
    try {
        const itemData = {
            ...req.body,
            tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002',
            created_by: req.user.id
        };

        const { data, error } = await supabaseAdmin
            .from('prostoral_inventory')
            .insert([itemData])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, item: data });
    } catch (error) {
        console.error('Erro ao criar item:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT - Atualizar item do estoque
app.put('/api/prostoral/inventory/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const itemData = {
            ...req.body,
            updated_by: req.user.id
        };

        const { data, error } = await supabaseAdmin
            .from('prostoral_inventory')
            .update(itemData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, item: data });
    } catch (error) {
        console.error('Erro ao atualizar item:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Registrar movimentação de estoque
app.post('/api/prostoral/inventory/:id/movement', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { movement_type, quantity, unit_cost, work_order_id, reason, notes } = req.body;

        const { data, error } = await supabaseAdmin
            .rpc('register_inventory_movement', {
                p_inventory_item_id: id,
                p_movement_type: movement_type,
                p_quantity: quantity,
                p_unit_cost: unit_cost,
                p_work_order_id: work_order_id,
                p_reference_document: null,
                p_reason: reason,
                p_notes: notes,
                p_performed_by: req.user.id,
                p_tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
            });

        if (error) throw error;

        res.json({ success: true, movement_id: data });
    } catch (error) {
        console.error('Erro ao registrar movimentação:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Itens com estoque baixo
app.get('/api/prostoral/inventory/low-stock', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .rpc('get_low_stock_items', {
                p_tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
            });

        if (error) throw error;

        res.json({ success: true, items: data });
    } catch (error) {
        console.error('Erro ao buscar itens com estoque baixo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ORDENS DE SERVIÇO ====================
// As rotas de Ordens de Serviço foram movidas para o módulo prostoral-ordens.js
// Veja a seção "ORDENS DE SERVIÇO - NOVO MÓDULO" no final deste arquivo

// ==================== KITS DE PROCEDIMENTOS ====================

// GET - Listar kits
app.get('/api/prostoral/kits', authenticateToken, async (req, res) => {
    try {
        const { work_type_id, search } = req.query;

        // Query simplificada para garantir funcionamento do dropdown
        let query = supabaseAdmin
            .from('kits')
            .select('*')
            .order('nome', { ascending: true });

        if (search) {
            query = query.ilike('nome', `%${search}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, kits: data });
    } catch (error) {
        console.error('Erro ao buscar kits:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Buscar kit por ID
app.get('/api/prostoral/kits/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('prostoral_procedure_kits')
            .select(`
                *,
                work_type:prostoral_work_types(*),
                items:prostoral_kit_items(
                    *,
                    inventory_item:prostoral_inventory(*)
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({ success: true, kit: data });
    } catch (error) {
        console.error('Erro ao buscar kit:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Criar novo kit
app.post('/api/prostoral/kits', authenticateToken, async (req, res) => {
    try {
        const { items, ...kitData } = req.body;

        const dataToInsert = {
            ...kitData,
            tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002',
            created_by: req.user.id
        };

        const { data: kit, error: kitError } = await supabaseAdmin
            .from('prostoral_procedure_kits')
            .insert([dataToInsert])
            .select()
            .single();

        if (kitError) throw kitError;

        // Adicionar itens ao kit
        if (items && items.length > 0) {
            const kitItems = items.map((item, index) => ({
                kit_id: kit.id,
                inventory_item_id: item.inventory_item_id,
                standard_quantity: item.standard_quantity,
                unit: item.unit,
                display_order: index
            }));

            const { error: itemsError } = await supabaseAdmin
                .from('prostoral_kit_items')
                .insert(kitItems);

            if (itemsError) throw itemsError;
        }

        res.json({ success: true, kit });
    } catch (error) {
        console.error('Erro ao criar kit:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT - Atualizar kit
app.put('/api/prostoral/kits/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { items, ...kitData } = req.body;

        const dataToUpdate = {
            ...kitData,
            updated_by: req.user.id
        };

        const { data: kit, error: kitError } = await supabaseAdmin
            .from('prostoral_procedure_kits')
            .update(dataToUpdate)
            .eq('id', id)
            .select()
            .single();

        if (kitError) throw kitError;

        // Se items foi fornecido, atualizar itens do kit
        if (items !== undefined) {
            // Remover itens antigos
            await supabaseAdmin
                .from('prostoral_kit_items')
                .delete()
                .eq('kit_id', id);

            // Adicionar novos itens
            if (items.length > 0) {
                const kitItems = items.map((item, index) => ({
                    kit_id: id,
                    inventory_item_id: item.inventory_item_id,
                    standard_quantity: item.standard_quantity,
                    unit: item.unit,
                    display_order: index
                }));

                const { error: itemsError } = await supabaseAdmin
                    .from('prostoral_kit_items')
                    .insert(kitItems);

                if (itemsError) throw itemsError;
            }
        }

        res.json({ success: true, kit });
    } catch (error) {
        console.error('Erro ao atualizar kit:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Desativar kit
app.delete('/api/prostoral/kits/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('prostoral_procedure_kits')
            .update({
                is_active: false,
                updated_by: req.user.id
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, kit: data });
    } catch (error) {
        console.error('Erro ao desativar kit:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Verificar disponibilidade de materiais do kit
app.get('/api/prostoral/kits/:id/availability', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .rpc('check_kit_inventory_availability', { p_kit_id: id });

        if (error) throw error;

        res.json({ success: true, availability: data });
    } catch (error) {
        console.error('Erro ao verificar disponibilidade:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== CONTROLE DE PRODUÇÃO ====================

// POST - Check-in (iniciar trabalho em OS)
app.post('/api/prostoral/time-tracking/checkin', authenticateToken, async (req, res) => {
    try {
        const { work_order_id, notes } = req.body;

        const trackingData = {
            work_order_id,
            technician_id: req.user.id,
            check_in_time: new Date().toISOString(),
            notes,
            tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
        };

        const { data, error } = await supabaseAdmin
            .from('prostoral_time_tracking')
            .insert([trackingData])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, tracking: data });
    } catch (error) {
        console.error('Erro ao fazer check-in:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH - Check-out (finalizar trabalho)
app.patch('/api/prostoral/time-tracking/:id/checkout', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const { data, error } = await supabaseAdmin
            .from('prostoral_time_tracking')
            .update({
                check_out_time: new Date().toISOString(),
                notes: notes || null
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, tracking: data });
    } catch (error) {
        console.error('Erro ao fazer check-out:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Listar registros de tempo
app.get('/api/prostoral/time-tracking', authenticateToken, async (req, res) => {
    try {
        const { work_order_id, technician_id, date_from, date_to } = req.query;

        let query = supabaseAdmin
            .from('prostoral_time_tracking')
            .select(`
                *,
                work_order:prostoral_work_orders(id, work_order_number, patient_name),
                technician:user_profiles(id, full_name)
            `)
            .order('check_in_time', { ascending: false });

        if (work_order_id) {
            query = query.eq('work_order_id', work_order_id);
        }

        if (technician_id) {
            query = query.eq('technician_id', technician_id);
        }

        if (date_from) {
            query = query.gte('check_in_time', date_from);
        }

        if (date_to) {
            query = query.lte('check_in_time', date_to);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, timeTracking: data });
    } catch (error) {
        console.error('Erro ao buscar registros de tempo:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Tempo ativo (check-ins sem check-out)
app.get('/api/prostoral/time-tracking/active', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('prostoral_time_tracking')
            .select(`
                *,
                work_order:prostoral_work_orders(id, work_order_number, patient_name, client_id)
            `)
            .is('check_out_time', null)
            .eq('technician_id', req.user.id)
            .order('check_in_time', { ascending: false });

        if (error) throw error;

        res.json({ success: true, activeTracking: data });
    } catch (error) {
        console.error('Erro ao buscar tempo ativo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== CMV (CUSTO DE MERCADORIA VENDIDA) ====================

// GET - Calcular CMV de uma OS
app.get('/api/prostoral/orders/:id/cmv', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .rpc('calculate_work_order_cmv', { p_work_order_id: id });

        if (error) throw error;

        res.json({ success: true, cmv: data });
    } catch (error) {
        console.error('Erro ao calcular CMV:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Consultar CMV registrado
app.get('/api/prostoral/cmv/:work_order_id', authenticateToken, async (req, res) => {
    try {
        const { work_order_id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('prostoral_cmv')
            .select('*')
            .eq('work_order_id', work_order_id)
            .order('calculated_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        res.json({ success: true, cmv: data || null });
    } catch (error) {
        console.error('Erro ao buscar CMV:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Registrar/Atualizar CMV
app.post('/api/prostoral/cmv', authenticateToken, async (req, res) => {
    try {
        const cmvData = {
            ...req.body,
            calculated_by: req.user.id,
            tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
        };

        const { data, error } = await supabaseAdmin
            .from('prostoral_cmv')
            .upsert(cmvData, { onConflict: 'work_order_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, cmv: data });
    } catch (error) {
        console.error('Erro ao registrar CMV:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Listar custos indiretos
app.get('/api/prostoral/indirect-costs', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('prostoral_indirect_costs')
            .select('*')
            .eq('is_active', true)
            .order('cost_type', { ascending: true });

        if (error) throw error;

        res.json({ success: true, costs: data });
    } catch (error) {
        console.error('Erro ao buscar custos indiretos:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== GESTÃO DE CONSERTOS ====================

// GET - Listar consertos
app.get('/api/prostoral/repairs', authenticateToken, async (req, res) => {
    try {
        const { status, original_order_id } = req.query;

        let query = supabaseAdmin
            .from('prostoral_repairs')
            .select(`
                *,
                original_order:original_work_order_id(id, work_order_number, patient_name),
                repair_order:repair_work_order_id(id, work_order_number, status)
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (original_order_id) {
            query = query.eq('original_work_order_id', original_order_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, repairs: data });
    } catch (error) {
        console.error('Erro ao buscar consertos:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Buscar conserto por ID
app.get('/api/prostoral/repairs/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('prostoral_repairs')
            .select(`
                *,
                original_order:original_work_order_id(*),
                repair_order:repair_work_order_id(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({ success: true, repair: data });
    } catch (error) {
        console.error('Erro ao buscar conserto:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Criar conserto
app.post('/api/prostoral/repairs', authenticateToken, async (req, res) => {
    try {
        const repairData = {
            ...req.body,
            created_by: req.user.id,
            tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002',
            status: req.body.status || 'pending'
        };

        const { data, error } = await supabaseAdmin
            .from('prostoral_repairs')
            .insert([repairData])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, repair: data });
    } catch (error) {
        console.error('Erro ao criar conserto:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH - Atualizar status do conserto
app.patch('/api/prostoral/repairs/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution_notes } = req.body;

        const updateData = {
            status,
            updated_by: req.user.id
        };

        if (status === 'completed') {
            updateData.resolved_at = new Date().toISOString();
            updateData.resolution_notes = resolution_notes;
        }

        const { data, error } = await supabaseAdmin
            .from('prostoral_repairs')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, repair: data });
    } catch (error) {
        console.error('Erro ao atualizar status do conserto:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== GESTÃO DE INTERCORRÊNCIAS ====================

// GET - Listar intercorrências
app.get('/api/prostoral/incidents', authenticateToken, async (req, res) => {
    try {
        const { status, work_order_id, severity } = req.query;

        let query = supabaseAdmin
            .from('prostoral_incidents')
            .select(`
                *,
                work_order:prostoral_work_orders(id, work_order_number, patient_name),
                reported_by_user:user_profiles!prostoral_incidents_reported_by_fkey(id, full_name)
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (work_order_id) {
            query = query.eq('work_order_id', work_order_id);
        }

        if (severity) {
            query = query.eq('severity', severity);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, incidents: data });
    } catch (error) {
        console.error('Erro ao buscar intercorrências:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Buscar intercorrência por ID
app.get('/api/prostoral/incidents/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('prostoral_incidents')
            .select(`
                *,
                work_order:prostoral_work_orders(*),
                reported_by_user:user_profiles!prostoral_incidents_reported_by_fkey(*),
                resolved_by_user:user_profiles!prostoral_incidents_resolved_by_fkey(*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({ success: true, incident: data });
    } catch (error) {
        console.error('Erro ao buscar intercorrência:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Criar intercorrência
app.post('/api/prostoral/incidents', authenticateToken, async (req, res) => {
    try {
        const incidentData = {
            ...req.body,
            reported_by: req.user.id,
            tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002',
            status: req.body.status || 'open'
        };

        const { data, error } = await supabaseAdmin
            .from('prostoral_incidents')
            .insert([incidentData])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, incident: data });
    } catch (error) {
        console.error('Erro ao criar intercorrência:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH - Atualizar status da intercorrência
app.patch('/api/prostoral/incidents/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution_notes } = req.body;

        const updateData = {
            status,
            resolved_by: status === 'resolved' ? req.user.id : null
        };

        if (status === 'resolved') {
            updateData.resolved_at = new Date().toISOString();
            updateData.resolution_notes = resolution_notes;
        }

        const { data, error } = await supabaseAdmin
            .from('prostoral_incidents')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, incident: data });
    } catch (error) {
        console.error('Erro ao atualizar status da intercorrência:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== FATURAÇÃO ====================

// GET - Listar faturas
app.get('/api/prostoral/invoices', authenticateToken, async (req, res) => {
    try {
        const { status, client_id, date_from, date_to } = req.query;

        let query = supabaseAdmin
            .from('prostoral_invoices')
            .select(`
                *,
                client:prostoral_clients(id, name, clinic_name, dentist_name),
                items:prostoral_invoice_items(
                    *,
                    work_order:prostoral_work_orders(id, work_order_number, patient_name)
                )
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (client_id) {
            query = query.eq('client_id', client_id);
        }

        if (date_from) {
            query = query.gte('issue_date', date_from);
        }

        if (date_to) {
            query = query.lte('issue_date', date_to);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, invoices: data });
    } catch (error) {
        console.error('Erro ao buscar faturas:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Buscar fatura por ID
app.get('/api/prostoral/invoices/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabaseAdmin
            .from('prostoral_invoices')
            .select(`
                *,
                client:prostoral_clients(*),
                items:prostoral_invoice_items(
                    *,
                    work_order:prostoral_work_orders(*)
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json({ success: true, invoice: data });
    } catch (error) {
        console.error('Erro ao buscar fatura:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST - Criar fatura
app.post('/api/prostoral/invoices', authenticateToken, async (req, res) => {
    try {
        const { items, ...invoiceData } = req.body;

        // Gerar número da fatura
        const { data: invoiceNumber, error: numberError } = await supabaseAdmin
            .rpc('get_next_invoice_number', {
                p_tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
            });

        if (numberError) throw numberError;

        const dataToInsert = {
            ...invoiceData,
            invoice_number: invoiceNumber,
            tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002',
            created_by: req.user.id,
            status: invoiceData.status || 'draft'
        };

        const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('prostoral_invoices')
            .insert([dataToInsert])
            .select()
            .single();

        if (invoiceError) throw invoiceError;

        // Adicionar itens da fatura
        if (items && items.length > 0) {
            const invoiceItems = items.map(item => ({
                invoice_id: invoice.id,
                work_order_id: item.work_order_id,
                description: item.description,
                quantity: item.quantity || 1,
                unit_price: item.unit_price,
                discount: item.discount || 0,
                tax_rate: item.tax_rate || 0
            }));

            const { error: itemsError } = await supabaseAdmin
                .from('prostoral_invoice_items')
                .insert(invoiceItems);

            if (itemsError) throw itemsError;
        }

        res.json({ success: true, invoice });
    } catch (error) {
        console.error('Erro ao criar fatura:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH - Atualizar status da fatura
app.patch('/api/prostoral/invoices/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updateData = {
            status,
            updated_by: req.user.id
        };

        if (status === 'sent') {
            updateData.sent_at = new Date().toISOString();
        } else if (status === 'paid') {
            updateData.paid_at = new Date().toISOString();
        }

        const { data, error } = await supabaseAdmin
            .from('prostoral_invoices')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, invoice: data });
    } catch (error) {
        console.error('Erro ao atualizar status da fatura:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Gerar PDF da fatura
app.get('/api/prostoral/invoices/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // TODO: Implementar geração de PDF
        // Por enquanto, retornar informação de que está em desenvolvimento
        res.json({
            success: false,
            message: 'Geração de PDF em desenvolvimento',
            invoice_id: id
        });
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== DASHBOARD E RELATÓRIOS ====================

// GET - KPIs principais do dashboard
app.get('/api/prostoral/dashboard/kpis', authenticateToken, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        const tenant_id = req.user.tenant_id || '00000000-0000-0000-0000-000000000002';

        // Total de OS
        let ordersQuery = supabaseAdmin
            .from('prostoral_work_orders')
            .select('id, status', { count: 'exact' })
            .eq('tenant_id', tenant_id);

        if (date_from) ordersQuery = ordersQuery.gte('created_at', date_from);
        if (date_to) ordersQuery = ordersQuery.lte('created_at', date_to);

        const { count: totalOrders } = await ordersQuery;

        // OS por status
        const { data: ordersByStatus } = await supabaseAdmin
            .from('prostoral_work_orders')
            .select('status')
            .eq('tenant_id', tenant_id);

        const statusCount = ordersByStatus?.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        }, {});

        // Faturamento
        let invoicesQuery = supabaseAdmin
            .from('prostoral_invoices')
            .select('total_amount, status')
            .eq('tenant_id', tenant_id);

        if (date_from) invoicesQuery = invoicesQuery.gte('issue_date', date_from);
        if (date_to) invoicesQuery = invoicesQuery.lte('issue_date', date_to);

        const { data: invoices } = await invoicesQuery;

        const revenue = invoices?.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;
        const paidRevenue = invoices?.filter(inv => inv.status === 'paid')
            .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;

        // Estoque baixo - buscar itens do laboratório com lógica ajustada (mínimo definido ou padrão 20)
        const { data: laboratoryItems } = await supabaseAdmin
            .from('vw_produtos_estoque')
            .select('quantidade_atual, quantidade_minima')
            .eq('ativo', true);

        const lowStockCount = laboratoryItems?.filter(item => {
            const minStock = (item.quantidade_minima && item.quantidade_minima > 0) ? item.quantidade_minima : 20;
            return item.quantidade_atual <= minStock;
        }).length || 0;

        // Intercorrências abertas
        const { count: openIncidents } = await supabaseAdmin
            .from('prostoral_incidents')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenant_id)
            .eq('status', 'open');

        res.json({
            success: true,
            kpis: {
                totalOrders: totalOrders || 0,
                ordersByStatus: statusCount || {},
                revenue: revenue.toFixed(2),
                paidRevenue: paidRevenue.toFixed(2),
                pendingRevenue: (revenue - paidRevenue).toFixed(2),
                lowStockItems: lowStockCount || 0,
                openIncidents: openIncidents || 0
            }
        });
    } catch (error) {
        console.error('Erro ao buscar KPIs:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Relatório de produção
app.get('/api/prostoral/reports/production', authenticateToken, async (req, res) => {
    try {
        const { date_from, date_to, technician_id } = req.query;
        const tenant_id = req.user.tenant_id || '00000000-0000-0000-0000-000000000002';

        let query = supabaseAdmin
            .from('prostoral_time_tracking')
            .select(`
                *,
                work_order:prostoral_work_orders(id, work_order_number, patient_name),
                technician:user_profiles(id, full_name)
            `)
            .eq('work_order.tenant_id', tenant_id)
            .not('check_out_time', 'is', null);

        if (date_from) query = query.gte('check_in_time', date_from);
        if (date_to) query = query.lte('check_in_time', date_to);
        if (technician_id) query = query.eq('technician_id', technician_id);

        const { data, error } = await query;

        if (error) throw error;

        // Calcular totais
        const totalHours = data?.reduce((sum, record) => {
            const checkIn = new Date(record.check_in_time);
            const checkOut = new Date(record.check_out_time);
            const hours = (checkOut - checkIn) / (1000 * 60 * 60);
            return sum + hours;
        }, 0) || 0;

        res.json({
            success: true,
            report: {
                records: data || [],
                totalHours: totalHours.toFixed(2),
                totalRecords: data?.length || 0
            }
        });
    } catch (error) {
        console.error('Erro ao gerar relatório de produção:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Relatório financeiro
app.get('/api/prostoral/reports/financial', authenticateToken, async (req, res) => {
    try {
        const { date_from, date_to, client_id } = req.query;
        const tenant_id = req.user.tenant_id || '00000000-0000-0000-0000-000000000002';

        let query = supabaseAdmin
            .from('prostoral_invoices')
            .select(`
                *,
                client:prostoral_clients(id, name, clinic_name)
            `)
            .eq('tenant_id', tenant_id);

        if (date_from) query = query.gte('issue_date', date_from);
        if (date_to) query = query.lte('issue_date', date_to);
        if (client_id) query = query.eq('client_id', client_id);

        const { data, error } = await query;

        if (error) throw error;

        // Calcular totais
        const totalRevenue = data?.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;
        const paidAmount = data?.filter(inv => inv.status === 'paid')
            .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;
        const pendingAmount = data?.filter(inv => inv.status === 'sent')
            .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;
        const overdueAmount = data?.filter(inv => inv.status === 'overdue')
            .reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;

        res.json({
            success: true,
            report: {
                invoices: data || [],
                summary: {
                    totalRevenue: totalRevenue.toFixed(2),
                    paidAmount: paidAmount.toFixed(2),
                    pendingAmount: pendingAmount.toFixed(2),
                    overdueAmount: overdueAmount.toFixed(2),
                    totalInvoices: data?.length || 0
                }
            }
        });
    } catch (error) {
        console.error('Erro ao gerar relatório financeiro:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Relatório de estoque
app.get('/api/prostoral/reports/inventory', authenticateToken, async (req, res) => {
    try {
        const { category, low_stock_only } = req.query;
        const tenant_id = req.user.tenant_id || '00000000-0000-0000-0000-000000000002';

        let query = supabaseAdmin
            .from('prostoral_inventory')
            .select('*')
            .eq('tenant_id', tenant_id);

        if (category) query = query.eq('category', category);
        if (low_stock_only === 'true') {
            query = query.lte('quantity', supabaseAdmin.raw('min_stock'));
        }

        const { data, error } = await query;

        if (error) throw error;

        // Calcular totais
        const totalValue = data?.reduce((sum, item) => {
            return sum + (item.quantity * (item.unit_cost || 0));
        }, 0) || 0;

        const lowStockItems = data?.filter(item => item.quantity <= (item.min_stock || 0)) || [];

        res.json({
            success: true,
            report: {
                items: data || [],
                summary: {
                    totalItems: data?.length || 0,
                    totalValue: totalValue.toFixed(2),
                    lowStockCount: lowStockItems.length
                }
            }
        });
    } catch (error) {
        console.error('Erro ao gerar relatório de estoque:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET - Relatório de CMV (Análise de custos)
app.get('/api/prostoral/reports/cmv', authenticateToken, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        const tenant_id = req.user.tenant_id || '00000000-0000-0000-0000-000000000002';

        let query = supabaseAdmin
            .from('prostoral_cmv')
            .select(`
                *,
                work_order:prostoral_work_orders(id, work_order_number, patient_name, status)
            `)
            .eq('tenant_id', tenant_id);

        if (date_from) query = query.gte('calculated_at', date_from);
        if (date_to) query = query.lte('calculated_at', date_to);

        const { data, error } = await query;

        if (error) throw error;

        // Calcular médias
        const avgMaterialCost = data?.reduce((sum, cmv) => sum + (parseFloat(cmv.direct_materials_cost) || 0), 0) / (data?.length || 1) || 0;
        const avgLaborCost = data?.reduce((sum, cmv) => sum + (parseFloat(cmv.direct_labor_cost) || 0), 0) / (data?.length || 1) || 0;
        const avgIndirectCost = data?.reduce((sum, cmv) => sum + (parseFloat(cmv.indirect_costs) || 0), 0) / (data?.length || 1) || 0;
        const avgTotalCost = data?.reduce((sum, cmv) => sum + (parseFloat(cmv.total_cost) || 0), 0) / (data?.length || 1) || 0;

        res.json({
            success: true,
            report: {
                records: data || [],
                summary: {
                    totalRecords: data?.length || 0,
                    avgMaterialCost: avgMaterialCost.toFixed(2),
                    avgLaborCost: avgLaborCost.toFixed(2),
                    avgIndirectCost: avgIndirectCost.toFixed(2),
                    avgTotalCost: avgTotalCost.toFixed(2)
                }
            }
        });
    } catch (error) {
        console.error('Erro ao gerar relatório de CMV:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// USER MANAGEMENT ROUTES (ADMIN ONLY)
// ============================================================================

// List all users (Admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const isAdmin = req.user.roles?.some(role => role.toLowerCase().includes('admin')) ||
            req.user.permissions?.includes('users:manage') ||
            req.user.permissions?.includes('admin:all');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Get all users from user_profiles table
        const { data: userProfiles, error: profilesError } = await supabaseAdmin
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (profilesError) {
            console.error('Erro ao listar perfis de usuários:', profilesError);
            throw profilesError;
        }

        // Get roles and auth data for each user
        const formattedUsers = await Promise.all(userProfiles.map(async (profile) => {
            // Get user roles
            const { data: userRoles } = await supabaseAdmin
                .from('user_roles')
                .select(`
                    role_id,
                    roles (
                        id,
                        name,
                        description
                    )
                `)
                .eq('user_id', profile.user_id)
                .eq('is_active', true);

            // Get permissions from roles
            const permissions = new Set();
            const roles = [];
            const roleDescriptions = [];

            if (userRoles && userRoles.length > 0) {
                for (const ur of userRoles) {
                    if (ur.roles) {
                        roles.push(ur.roles.name);
                        if (ur.roles.description) {
                            roleDescriptions.push(ur.roles.description);
                        }

                        // Get permissions for this role (CORRIGIDO)
                        const { data: rolePerms } = await supabaseAdmin
                            .from('role_permissions')
                            .select(`
                                permission_id,
                                permissions (
                                    name,
                                    action,
                                    module_name
                                )
                            `)
                            .eq('role_id', ur.role_id);

                        rolePerms?.forEach(rp => {
                            if (rp.permissions?.name) {
                                permissions.add(rp.permissions.name);
                            }
                        });
                    }
                }
            }

            // Get user's module access from user_module_access
            const { data: userModules } = await supabaseAdmin
                .from('user_module_access')
                .select(`
                    module_id,
                    is_active,
                    modules (
                        id,
                        code,
                        name
                    )
                `)
                .eq('user_id', profile.user_id)
                .eq('is_active', true);

            // Extract module codes for permissions array
            // NOVO: Adiciona todas as permissões básicas para cada módulo
            if (userModules && userModules.length > 0) {
                userModules.forEach(um => {
                    if (um.modules) {
                        // Adiciona permissões básicas se não existirem via roles
                        const moduleCode = um.modules.code;
                        permissions.add(`${moduleCode}:read`);
                        permissions.add(`${moduleCode}:create`);
                        permissions.add(`${moduleCode}:update`);
                        permissions.add(`${moduleCode}:delete`);
                    }
                });
            }

            // NOVO: Se não tem roles, cria uma descrição virtual baseada nos módulos
            if (roles.length === 0 && userModules && userModules.length > 0) {
                const moduleNames = userModules.map(um => um.modules?.name).filter(Boolean);
                if (moduleNames.length > 0) {
                    roleDescriptions.push(`Acesso a: ${moduleNames.join(', ')}`);
                }
            }

            // Get user's auth data from Supabase Auth
            let email = 'N/A';
            try {
                const { data: authData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
                email = authData?.user?.email || email;
            } catch (authError) {
                console.error(`Erro ao buscar email do usuário ${profile.user_id}:`, authError);
            }

            return {
                id: profile.user_id,
                email: email,
                full_name: profile.display_name || profile.first_name || 'Usuário',
                is_active: profile.is_active !== false,
                roles: roles,
                role_descriptions: roleDescriptions,  // NOVO: descrições das roles
                permissions: Array.from(permissions),
                modules: userModules?.map(um => um.modules) || [] // adiciona módulos
            };
        }));

        res.json({ success: true, users: formattedUsers });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all available roles (Admin only)
app.get('/api/admin/roles', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const isAdmin = req.user.roles?.some(role => role.toLowerCase().includes('admin')) ||
            req.user.permissions?.includes('users:manage') ||
            req.user.permissions?.includes('admin:all');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Get all roles
        const { data: roles, error } = await supabaseAdmin
            .from('roles')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) {
            console.error('Erro ao listar roles:', error);
            throw error;
        }

        res.json({ success: true, roles });
    } catch (error) {
        console.error('Erro ao buscar roles:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new user (Admin only)
app.post('/api/admin/users', authenticateToken, async (req, res) => {
    let createdUserId = null;

    try {
        // Check if user is admin
        const isAdmin = req.user.roles?.some(role => role.toLowerCase().includes('admin')) ||
            req.user.permissions?.includes('users:manage') ||
            req.user.permissions?.includes('admin:all');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        const { email, password, full_name, is_admin, permissions } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        console.log('🔵 Iniciando criação de usuário:', email);

        // ETAPA 1: Create user in Supabase Auth with metadata
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: full_name || null,
                must_change_password: true,
                last_password_change: null
            }
        });

        if (authError) {
            console.error('❌ Erro ao criar usuário no Auth:', authError);
            throw new Error(`Falha ao criar usuário: ${authError.message}`);
        }

        createdUserId = authData.user.id;
        console.log('✅ Usuário criado no Auth:', createdUserId);

        // ETAPA 2: Create entry in public.users (required for foreign key)
        const { error: publicUserError } = await supabaseAdmin
            .from('users')
            .insert([{
                id: createdUserId,
                email: email,
                created_at: new Date().toISOString()
            }]);

        if (publicUserError) {
            console.error('❌ Erro ao criar usuário em public.users:', publicUserError);
            // Rollback: deletar usuário do Auth
            await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            throw new Error(`Falha ao criar registro de usuário: ${publicUserError.message}`);
        }

        console.log('✅ Usuário criado em public.users');

        // ETAPA 3: Create user profile in user_profiles
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert([{
                user_id: createdUserId,
                display_name: full_name || null,
                is_active: true,
                tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
            }]);

        if (profileError) {
            console.error('❌ Erro ao criar perfil:', profileError);
            // Rollback: deletar usuário do Auth e public.users
            await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            await supabaseAdmin.from('users').delete().eq('id', createdUserId);
            throw new Error(`Falha ao criar perfil: ${profileError.message}`);
        }

        console.log('✅ Perfil criado em user_profiles');

        // ETAPA 4: Process permissions and create module access + granular permissions
        if (permissions && permissions.length > 0) {
            // Group permissions by module (extract unique module codes)
            const moduleCodes = new Set();

            for (const perm of permissions) {
                const [moduleCode, action] = perm.split(':');
                moduleCodes.add(moduleCode);
            }

            console.log('📦 Módulos a liberar:', Array.from(moduleCodes));
            console.log('🔑 Permissões específicas recebidas:', permissions);

            // ETAPA 4.1: Create user_module_access entries (one per module)
            for (const moduleCode of moduleCodes) {
                // Get module ID
                const { data: module, error: moduleError } = await supabaseAdmin
                    .from('modules')
                    .select('id')
                    .eq('code', moduleCode)
                    .single();

                if (moduleError || !module) {
                    console.warn(`⚠️ Módulo não encontrado: ${moduleCode}`);
                    continue;
                }

                // Insert module access (simple: just grants access to the module)
                const { error: accessError } = await supabaseAdmin
                    .from('user_module_access')
                    .insert([{
                        user_id: createdUserId,
                        module_id: module.id,
                        granted_by: req.user.id,
                        is_active: true
                    }]);

                if (accessError) {
                    console.error(`❌ Erro ao criar acesso ao módulo ${moduleCode}:`, accessError);
                    // Rollback completo
                    await supabaseAdmin.auth.admin.deleteUser(createdUserId);
                    await supabaseAdmin.from('users').delete().eq('id', createdUserId);
                    await supabaseAdmin.from('user_profiles').delete().eq('user_id', createdUserId);
                    throw new Error(`Falha ao atribuir permissões: ${accessError.message}`);
                }

                console.log(`✅ Acesso ao módulo ${moduleCode} criado`);
            }

            // ETAPA 4.2: Create custom role with granular permissions
            console.log('🎭 Criando role customizada para permissões granulares...');

            // Create custom role for this user
            const roleName = `user_${createdUserId.substring(0, 8)}_permissions`;
            const { data: customRole, error: roleCreateError } = await supabaseAdmin
                .from('roles')
                .insert([{
                    name: roleName,
                    display_name: `Permissões de ${full_name || email}`,
                    description: `Role customizada com permissões específicas`,
                    is_active: true,
                    tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
                }])
                .select()
                .single();

            if (roleCreateError) {
                console.error('❌ Erro ao criar role customizada:', roleCreateError);
                // Rollback completo
                await supabaseAdmin.auth.admin.deleteUser(createdUserId);
                await supabaseAdmin.from('users').delete().eq('id', createdUserId);
                await supabaseAdmin.from('user_profiles').delete().eq('user_id', createdUserId);
                await supabaseAdmin.from('user_module_access').delete().eq('user_id', createdUserId);
                throw new Error(`Falha ao criar role: ${roleCreateError.message}`);
            }

            console.log('✅ Role customizada criada:', customRole.id);

            // Assign role to user
            const { error: userRoleError } = await supabaseAdmin
                .from('user_roles')
                .insert([{
                    user_id: createdUserId,
                    role_id: customRole.id,
                    tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002',
                    is_active: true
                }]);

            if (userRoleError) {
                console.error('❌ Erro ao atribuir role ao usuário:', userRoleError);
                // Rollback
                await supabaseAdmin.auth.admin.deleteUser(createdUserId);
                await supabaseAdmin.from('users').delete().eq('id', createdUserId);
                await supabaseAdmin.from('user_profiles').delete().eq('user_id', createdUserId);
                await supabaseAdmin.from('user_module_access').delete().eq('user_id', createdUserId);
                await supabaseAdmin.from('roles').delete().eq('id', customRole.id);
                throw new Error(`Falha ao atribuir role: ${userRoleError.message}`);
            }

            console.log('✅ Role atribuída ao usuário');

            // ETAPA 4.3: Link specific permissions to the custom role
            for (const permName of permissions) {
                // Find the permission in the permissions table
                const { data: permission, error: permError } = await supabaseAdmin
                    .from('permissions')
                    .select('id')
                    .eq('name', permName)
                    .maybeSingle();

                if (permError || !permission) {
                    console.warn(`⚠️ Permissão não encontrada: ${permName}`);
                    continue;
                }

                // Link permission to role
                const { error: rolePermError } = await supabaseAdmin
                    .from('role_permissions')
                    .insert([{
                        role_id: customRole.id,
                        permission_id: permission.id
                    }]);

                if (rolePermError) {
                    console.warn(`⚠️ Erro ao vincular permissão ${permName}:`, rolePermError);
                }

                console.log(`✅ Permissão ${permName} vinculada à role`);
            }
        }

        // ETAPA 5: Assign admin role if needed
        if (is_admin) {
            const { data: adminRole } = await supabaseAdmin
                .from('roles')
                .select('id')
                .eq('name', 'admin')
                .single();

            if (adminRole) {
                const { error: roleError } = await supabaseAdmin
                    .from('user_roles')
                    .insert([{
                        user_id: createdUserId,
                        role_id: adminRole.id,
                        tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
                    }]);

                if (roleError) {
                    console.warn('⚠️ Erro ao atribuir role admin:', roleError);
                }
            }

            // IMPORTANTE: Admins precisam de acesso a TODOS os módulos em user_module_access
            // Buscar todos os módulos disponíveis
            const { data: allModules, error: modulesError } = await supabaseAdmin
                .from('modules')
                .select('id, code, name')
                .eq('is_active', true);

            if (!modulesError && allModules && allModules.length > 0) {
                console.log('📦 Criando acesso admin a todos os módulos:', allModules.length);

                // Criar acesso para cada módulo
                for (const module of allModules) {
                    const { error: accessError } = await supabaseAdmin
                        .from('user_module_access')
                        .insert([{
                            user_id: createdUserId,
                            module_id: module.id,
                            granted_by: req.user.id,
                            is_active: true
                        }]);

                    if (accessError) {
                        console.error(`❌ Erro ao criar acesso admin ao módulo ${module.code}:`, accessError);
                        // Não fazer rollback completo, apenas avisar
                    } else {
                        console.log(`✅ Acesso admin ao módulo ${module.code} criado`);
                    }
                }
            }
        }

        console.log('✅ Usuário criado com sucesso:', email);

        res.json({
            success: true,
            message: 'Usuário criado com sucesso',
            user: {
                id: createdUserId,
                email: email,
                full_name: full_name
            }
        });
    } catch (error) {
        console.error('❌ Erro fatal ao criar usuário:', error);

        // Tentativa final de rollback se algo der errado
        if (createdUserId) {
            try {
                await supabaseAdmin.auth.admin.deleteUser(createdUserId);
                await supabaseAdmin.from('users').delete().eq('id', createdUserId);
                await supabaseAdmin.from('user_profiles').delete().eq('user_id', createdUserId);
                await supabaseAdmin.from('user_module_access').delete().eq('user_id', createdUserId);
            } catch (rollbackError) {
                console.error('❌ Erro no rollback:', rollbackError);
            }
        }

        res.status(500).json({
            error: error.message || 'Erro ao criar usuário',
            details: error.toString()
        });
    }
});

// Update user (Admin only)
app.put('/api/admin/users/:userId', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const isAdmin = req.user.roles?.some(role => role.toLowerCase().includes('admin')) ||
            req.user.permissions?.includes('users:manage') ||
            req.user.permissions?.includes('admin:all');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        const { userId } = req.params;
        const { full_name, is_admin, permissions } = req.body;

        console.log('🔵 Atualizando usuário:', userId);
        console.log('📦 Permissões recebidas:', permissions);

        // Update profile in user_profiles (not 'profiles')
        if (full_name !== undefined) {
            const { error: profileError } = await supabaseAdmin
                .from('user_profiles')
                .update({ display_name: full_name })
                .eq('user_id', userId);

            if (profileError) {
                console.error('❌ Erro ao atualizar perfil:', profileError);
            } else {
                console.log('✅ Perfil atualizado');
            }

            // Also update auth metadata
            await supabaseAdmin.auth.admin.updateUserById(userId, {
                user_metadata: { full_name }
            });
        }

        // ETAPA 1: Remove existing user_module_access
        const { error: deleteAccessError } = await supabaseAdmin
            .from('user_module_access')
            .delete()
            .eq('user_id', userId);

        if (deleteAccessError) {
            console.error('❌ Erro ao deletar acessos antigos:', deleteAccessError);
        } else {
            console.log('✅ Acessos antigos removidos');
        }

        // ETAPA 2: Remove existing custom roles (keep admin role for now if exists)
        const { data: existingRoles } = await supabaseAdmin
            .from('user_roles')
            .select('role_id, roles(name)')
            .eq('user_id', userId);

        if (existingRoles) {
            for (const userRole of existingRoles) {
                // Delete custom roles (those starting with user_)
                if (userRole.roles?.name?.startsWith('user_')) {
                    // Delete role_permissions first
                    await supabaseAdmin
                        .from('role_permissions')
                        .delete()
                        .eq('role_id', userRole.role_id);

                    // Delete user_role
                    await supabaseAdmin
                        .from('user_roles')
                        .delete()
                        .eq('user_id', userId)
                        .eq('role_id', userRole.role_id);

                    // Delete the role itself
                    await supabaseAdmin
                        .from('roles')
                        .delete()
                        .eq('id', userRole.role_id);

                    console.log('✅ Role customizada antiga removida');
                }
            }
        }

        // ETAPA 3: Process permissions and create new module access + granular permissions
        if (permissions && permissions.length > 0) {
            // Extract unique module codes from permissions
            const moduleCodes = new Set();

            for (const perm of permissions) {
                const [moduleCode, action] = perm.split(':');
                moduleCodes.add(moduleCode);
            }

            console.log('📦 Módulos a liberar:', Array.from(moduleCodes));
            console.log('🔑 Permissões específicas recebidas:', permissions);

            // ETAPA 3.1: Create user_module_access entries (one per module)
            for (const moduleCode of moduleCodes) {
                // Get module ID
                const { data: module, error: moduleError } = await supabaseAdmin
                    .from('modules')
                    .select('id')
                    .eq('code', moduleCode)
                    .single();

                if (moduleError || !module) {
                    console.warn(`⚠️ Módulo não encontrado: ${moduleCode}`);
                    continue;
                }

                // Insert module access (simple: just grants access to the module)
                const { error: accessError } = await supabaseAdmin
                    .from('user_module_access')
                    .insert([{
                        user_id: userId,
                        module_id: module.id,
                        granted_by: req.user.id,
                        is_active: true
                    }]);

                if (accessError) {
                    console.error(`❌ Erro ao criar acesso ao módulo ${moduleCode}:`, accessError);
                } else {
                    console.log(`✅ Acesso ao módulo ${moduleCode} criado`);
                }
            }

            // ETAPA 3.2: Create custom role with granular permissions
            console.log('🎭 Criando role customizada para permissões granulares...');
            console.log('🔑 Permissões a vincular:', permissions);

            // Create custom role for this user
            const roleName = `user_${userId.substring(0, 8)}_permissions`;
            const { data: customRole, error: roleCreateError } = await supabaseAdmin
                .from('roles')
                .insert([{
                    name: roleName,
                    description: `Permissões customizadas de ${full_name || 'usuário'}`,
                    level: 10,
                    is_system: false,
                    tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
                }])
                .select()
                .single();

            if (roleCreateError) {
                console.error('❌ Erro ao criar role customizada:', roleCreateError);
                throw new Error(`Falha ao criar role: ${roleCreateError.message}`);
            } else {
                console.log('✅ Role customizada criada:', customRole.id, customRole.name);

                // Assign role to user
                const { error: userRoleError } = await supabaseAdmin
                    .from('user_roles')
                    .insert([{
                        user_id: userId,
                        role_id: customRole.id,
                        tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002',
                        is_active: true
                    }]);

                if (userRoleError) {
                    console.error('❌ Erro ao atribuir role ao usuário:', userRoleError);
                    throw new Error(`Falha ao atribuir role: ${userRoleError.message}`);
                } else {
                    console.log('✅ Role atribuída ao usuário');

                    // ETAPA 3.3: Link specific permissions to the custom role
                    console.log(`🔗 Vinculando ${permissions.length} permissões à role ${customRole.id}...`);
                    let permissionsLinked = 0;
                    let permissionsNotFound = 0;

                    for (const permName of permissions) {
                        // Find the permission in the permissions table
                        const { data: permission, error: permError } = await supabaseAdmin
                            .from('permissions')
                            .select('id, name')
                            .eq('name', permName)
                            .maybeSingle();

                        if (permError || !permission) {
                            console.warn(`⚠️ Permissão não encontrada no banco: ${permName}`);
                            permissionsNotFound++;
                            continue;
                        }

                        console.log(`   🔍 Permissão encontrada: ${permission.name} (${permission.id})`);

                        // Link permission to role
                        const { error: rolePermError } = await supabaseAdmin
                            .from('role_permissions')
                            .insert([{
                                role_id: customRole.id,
                                permission_id: permission.id
                            }]);

                        if (rolePermError) {
                            console.warn(`⚠️ Erro ao vincular permissão ${permName}:`, rolePermError.message);
                        } else {
                            console.log(`   ✅ Permissão ${permName} vinculada à role`);
                            permissionsLinked++;
                        }
                    }

                    console.log(`📊 Resultado: ${permissionsLinked} vinculadas, ${permissionsNotFound} não encontradas`);
                }
            }
        }

        // ETAPA 4: Handle admin role
        // Remove existing admin roles if switching from admin to normal user
        await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .in('role_id', (await supabaseAdmin.from('roles').select('id').eq('name', 'admin')).data.map(r => r.id));

        if (is_admin) {
            // Assign admin role
            const { data: adminRole } = await supabaseAdmin
                .from('roles')
                .select('id')
                .eq('name', 'admin')
                .single();

            if (adminRole) {
                await supabaseAdmin
                    .from('user_roles')
                    .insert([{
                        user_id: userId,
                        role_id: adminRole.id,
                        tenant_id: req.user.tenant_id || '00000000-0000-0000-0000-000000000002'
                    }]);
                console.log('✅ Role admin atribuído');
            }

            // IMPORTANTE: Admins precisam de acesso a TODOS os módulos em user_module_access
            // Buscar todos os módulos disponíveis
            const { data: allModules, error: modulesError } = await supabaseAdmin
                .from('modules')
                .select('id, code, name')
                .eq('is_active', true);

            if (!modulesError && allModules && allModules.length > 0) {
                console.log('📦 Criando acesso admin a todos os módulos:', allModules.length);

                // Criar acesso para cada módulo
                for (const module of allModules) {
                    const { error: accessError } = await supabaseAdmin
                        .from('user_module_access')
                        .insert([{
                            user_id: userId,
                            module_id: module.id,
                            granted_by: req.user.id,
                            is_active: true
                        }]);

                    if (accessError) {
                        console.error(`❌ Erro ao criar acesso admin ao módulo ${module.code}:`, accessError);
                    } else {
                        console.log(`✅ Acesso admin ao módulo ${module.code} criado`);
                    }
                }
            }
        }

        console.log('✅ Usuário atualizado com sucesso');

        res.json({
            success: true,
            message: 'Usuário atualizado com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// Toggle user status (Admin only)
app.patch('/api/admin/users/:userId/status', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const isAdmin = req.user.roles?.some(role => role.toLowerCase().includes('admin')) ||
            req.user.permissions?.includes('users:manage') ||
            req.user.permissions?.includes('admin:all');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        const { userId } = req.params;
        const { is_active } = req.body;

        // Update profile status
        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ is_active })
            .eq('user_id', userId);

        if (error) throw error;

        res.json({
            success: true,
            message: `Usuário ${is_active ? 'ativado' : 'desativado'} com sucesso`
        });
    } catch (error) {
        console.error('Erro ao atualizar status do usuário:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// ENDPOINTS DO LABORATÓRIO
// =====================================================

// Get produtos do laboratório
app.get('/api/laboratorio/produtos', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, categoria, status, sort = 'nome_material', order = 'asc' } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('vw_produtos_estoque')
            .select('*', { count: 'exact' });
        // Nota: a view já filtra por deleted_at IS NULL

        if (search) {
            query = query.or(`nome_material.ilike.%${search}%,marca.ilike.%${search}%,fornecedor.ilike.%${search}%,qr_code.ilike.%${search}%`);
        }
        if (categoria) query = query.eq('categoria', categoria);
        if (status) query = query.eq('status', status);

        query = query.order(sort, { ascending: order === 'asc' }).range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({
            data: data || [],
            currentPage: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit),
            total: count || 0
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get produto by ID
app.get('/api/laboratorio/produtos/:id', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('vw_produtos_estoque')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Produto não encontrado' });

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get produto by QR code or barcode
app.get('/api/laboratorio/produtos/codigo/:codigo', authenticateToken, async (req, res) => {
    try {
        const codigo = decodeURIComponent(req.params.codigo);

        const { data, error } = await supabase
            .from('vw_produtos_estoque')
            .select('*')
            .or(`qr_code.eq.${codigo},codigo_barras.eq.${codigo}`)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Produto não encontrado' });

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get produto details
app.get('/api/laboratorio/produtos/:id/detalhes', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('vw_produtos_estoque')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Produto não encontrado' });

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar detalhes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create produto
app.post('/api/laboratorio/produtos', authenticateToken, async (req, res) => {
    try {
        const {
            codigo_barras,
            categoria,
            nome_material,
            marca,
            fornecedor,
            referencia_lote,
            unidade_medida,
            localizacao,
            data_validade,
            descricao,
            observacoes,
            quantidade_inicial,
            quantidade_minima,
            estoque_minimo,
            quantidade_maxima,
            estoque_maximo
        } = req.body;

        // Aceitar ambos os nomes para compatibilidade
        const quantidadeMin = quantidade_minima || estoque_minimo;
        const quantidadeMax = quantidade_maxima || estoque_maximo;

        const userId = req.user.id;

        // Insert produto
        const { data: produto, error: produtoError } = await supabaseAdmin
            .from('produtoslaboratorio')
            .insert({
                codigo_barras,
                categoria,
                nome_material,
                marca,
                fornecedor,
                referencia_lote,
                unidade_medida,
                localizacao,
                data_validade,
                descricao,
                observacoes,
                criado_por: userId,
                atualizado_por: userId
            })
            .select()
            .single();

        if (produtoError) throw produtoError;

        // Create estoque if quantidade_inicial is provided
        if (quantidade_inicial !== undefined && quantidade_inicial !== null) {
            const { error: estoqueError } = await supabaseAdmin
                .from('estoquelaboratorio')
                .insert({
                    produto_id: produto.id,
                    quantidade_atual: 0, // Fix: Iniciar com 0 pois o trigger irá somar a movimentação
                    quantidade_minima: quantidadeMin || 0,
                    quantidade_maxima: quantidadeMax || null,
                    atualizado_por: userId
                });

            if (estoqueError) throw estoqueError;

            // Register initial movement if quantity > 0
            if (parseFloat(quantidade_inicial) > 0) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', userId)
                    .single();

                await supabaseAdmin
                    .from('movimentacoeslaboratorio')
                    .insert({
                        produto_id: produto.id,
                        tipo: 'entrada',
                        quantidade: quantidade_inicial,
                        responsavel: profile?.full_name || 'Sistema',
                        motivo: 'Estoque inicial',
                        registrado_por: userId
                    });
            }
        }

        res.json({ success: true, data: produto });
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update produto
app.put('/api/laboratorio/produtos/:id', authenticateToken, async (req, res) => {
    try {
        const {
            codigo_barras,
            categoria,
            nome_material,
            marca,
            fornecedor,
            referencia_lote,
            unidade_medida,
            localizacao,
            data_validade,
            descricao,
            observacoes,
            ativo,
            estoque_minimo,
            quantidade_minima,
            quantidade_maxima,
            estoque_maximo
        } = req.body;

        // Aceitar ambos os nomes para compatibilidade
        const quantidadeMin = quantidade_minima || estoque_minimo;
        const quantidadeMax = quantidade_maxima || estoque_maximo;

        // Update produto
        const { error: produtoError } = await supabaseAdmin
            .from('produtoslaboratorio')
            .update({
                codigo_barras,
                categoria,
                nome_material,
                marca,
                fornecedor,
                referencia_lote,
                unidade_medida,
                localizacao,
                data_validade,
                descricao,
                observacoes,
                ativo,
                atualizado_por: req.user.id,
                data_atualizacao: new Date().toISOString()
            })
            .eq('id', req.params.id);

        if (produtoError) throw produtoError;

        // Update estoque if values are provided
        if (quantidadeMin !== undefined || quantidadeMax !== undefined) {
            // Use upsert to handle both insert and update in one operation
            const { error: estoqueError } = await supabaseAdmin
                .from('estoquelaboratorio')
                .upsert({
                    produto_id: req.params.id,
                    quantidade_minima: quantidadeMin || 0,
                    quantidade_maxima: quantidadeMax || null,
                    atualizado_por: req.user.id
                }, {
                    onConflict: 'produto_id',
                    ignoreDuplicates: false
                });

            if (estoqueError) throw estoqueError;
        }

        res.json({ success: true, message: 'Produto atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get produtos stats
app.get('/api/laboratorio/produtos/stats', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('vw_produtos_estoque')
            .select('status');

        if (error) throw error;

        const stats = {
            total: data.length,
            ok: data.filter(p => p.status === 'ok').length,
            alerta: data.filter(p => p.status === 'alerta').length,
            critico: data.filter(p => p.status === 'critico' || p.status === 'vencido').length
        };

        res.json(stats);
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get alertas
app.get('/api/laboratorio/alertas', authenticateToken, async (req, res) => {
    try {
        const { data: produtos, error } = await supabase
            .from('vw_produtos_estoque')
            .select('*');

        if (error) throw error;

        const alertas = [];
        const hoje = new Date();
        const em30Dias = new Date();
        em30Dias.setDate(hoje.getDate() + 30);

        produtos.forEach(produto => {
            const qtdAtual = parseFloat(produto.quantidade_atual || 0);
            const qtdMin = parseFloat(produto.quantidade_minima || 0);
            const qtdCritica = 5; // Default critical threshold
            const qtdBaixa = qtdMin > 0 ? qtdMin : 20; // Default low threshold if min not set

            // Alerta: Estoque Crítico (esgotado ou muito baixo)
            if (qtdAtual <= qtdCritica) {
                alertas.push({
                    id: `critico-${produto.id}`,
                    tipo: 'critico',
                    titulo: qtdAtual === 0 ? 'Estoque Esgotado' : 'Estoque Crítico',
                    mensagem: `${produto.nome_material} está com estoque ${qtdAtual === 0 ? 'esgotado' : 'crítico'} (${qtdAtual} ${produto.unidade_medida})`,
                    produto_id: produto.id,
                    produto_nome: produto.nome_material,
                    quantidade_atual: qtdAtual,
                    data_criacao: new Date().toISOString()
                });
            }
            // Alerta: Estoque Baixo
            else if (qtdAtual <= qtdBaixa) {
                alertas.push({
                    id: `aviso-${produto.id}`,
                    tipo: 'aviso',
                    titulo: 'Estoque Baixo',
                    mensagem: `${produto.nome_material} está com estoque baixo (${qtdAtual} ${produto.unidade_medida})`,
                    produto_id: produto.id,
                    produto_nome: produto.nome_material,
                    quantidade_atual: qtdAtual,
                    quantidade_minima: qtdMin,
                    data_criacao: new Date().toISOString()
                });
            }

            // Alerta: Produto Vencido
            if (produto.data_validade) {
                const dataValidade = new Date(produto.data_validade);

                if (dataValidade < hoje) {
                    alertas.push({
                        id: `vencido-${produto.id}`,
                        tipo: 'critico',
                        titulo: 'Produto Vencido',
                        mensagem: `${produto.nome_material} venceu em ${new Date(produto.data_validade).toLocaleDateString('pt-BR')}`,
                        produto_id: produto.id,
                        produto_nome: produto.nome_material,
                        data_validade: produto.data_validade,
                        data_criacao: new Date().toISOString()
                    });
                }
                // Alerta: Produto Próximo ao Vencimento
                else if (dataValidade <= em30Dias && dataValidade > hoje) {
                    const diasRestantes = Math.ceil((dataValidade - hoje) / (1000 * 60 * 60 * 24));
                    alertas.push({
                        id: `vencimento-${produto.id}`,
                        tipo: diasRestantes <= 7 ? 'aviso' : 'informativo',
                        titulo: 'Próximo ao Vencimento',
                        mensagem: `${produto.nome_material} vence em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''} (${new Date(produto.data_validade).toLocaleDateString('pt-BR')})`,
                        produto_id: produto.id,
                        produto_nome: produto.nome_material,
                        data_validade: produto.data_validade,
                        dias_restantes: diasRestantes,
                        data_criacao: new Date().toISOString()
                    });
                }
            }

            // Alerta: Estoque Acima do Máximo
            if (produto.quantidade_maxima &&
                parseFloat(produto.quantidade_atual || 0) > parseFloat(produto.quantidade_maxima)) {
                alertas.push({
                    id: `excesso-${produto.id}`,
                    tipo: 'informativo',
                    titulo: 'Estoque Acima do Máximo',
                    mensagem: `${produto.nome_material} está acima do estoque máximo (${produto.quantidade_atual}/${produto.quantidade_maxima} ${produto.unidade_medida})`,
                    produto_id: produto.id,
                    produto_nome: produto.nome_material,
                    quantidade_atual: produto.quantidade_atual,
                    quantidade_maxima: produto.quantidade_maxima,
                    data_criacao: new Date().toISOString()
                });
            }
        });

        // Ordenar por tipo (crítico > aviso > informativo) e depois por data
        const ordemTipo = { 'critico': 0, 'aviso': 1, 'informativo': 2 };
        alertas.sort((a, b) => {
            const diff = ordemTipo[a.tipo] - ordemTipo[b.tipo];
            if (diff !== 0) return diff;
            return new Date(b.data_criacao) - new Date(a.data_criacao);
        });

        res.json({ data: alertas });
    } catch (error) {
        console.error('Erro ao buscar alertas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get movimentações
app.get('/api/laboratorio/movimentacoes', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, tipo, dataInicio, dataFim } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('vw_movimentacoes_detalhadas')
            .select('*', { count: 'exact' });

        if (search) {
            query = query.or(`produto_nome.ilike.%${search}%,caso_clinico.ilike.%${search}%,responsavel_nome.ilike.%${search}%`);
        }
        if (tipo) query = query.eq('tipo_movimento', tipo);
        if (dataInicio) query = query.gte('data_movimentacao', dataInicio);
        if (dataFim) {
            const dataFimFinal = new Date(dataFim);
            dataFimFinal.setDate(dataFimFinal.getDate() + 1);
            query = query.lt('data_movimentacao', dataFimFinal.toISOString().split('T')[0]);
        }

        query = query.order('data_movimentacao', { ascending: false }).range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        res.json({
            data: data || [],
            currentPage: parseInt(page),
            totalPages: Math.ceil((count || 0) / limit),
            total: count || 0
        });
    } catch (error) {
        console.error('Erro ao buscar movimentações:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get movimentação by ID
app.get('/api/laboratorio/movimentacoes/:id', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('vw_movimentacoes_detalhadas')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Movimentação não encontrada' });

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar movimentação:', error);
        res.status(500).json({ error: error.message });
    }
});

// Register entrada
app.post('/api/laboratorio/movimentacoes/entrada', authenticateToken, upload.single('anexo'), async (req, res) => {
    try {
        const {
            produto_id,
            quantidade,
            motivo,
            observacoes,
            responsavel,
            preco_unitario,
            custo_unitario,
            fornecedor,
            numero_pedido
        } = req.body;

        const userId = req.user.id;

        // Process file upload if exists
        let anexoUrl = null;
        if (req.file) {
            const sanitizedName = sanitizeFileName(req.file.originalname);
            const fileName = `movimentacao-${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;

            try {
                // Upload para bucket 'anexos'
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('anexos')
                    .upload(`laboratorio/${fileName}`, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Gerar URL pública
                const { data: { publicUrl } } = supabaseAdmin.storage
                    .from('anexos')
                    .getPublicUrl(`laboratorio/${fileName}`);

                anexoUrl = publicUrl;
            } catch (uploadError) {
                console.error('Erro ao fazer upload do anexo:', uploadError);
                throw new Error('Erro ao fazer upload do anexo: ' + uploadError.message);
            }
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        // Registrar movimentação
        const { data: movimentacao, error } = await supabaseAdmin
            .from('movimentacoeslaboratorio')
            .insert({
                produto_id,
                tipo: 'entrada',
                quantidade,
                responsavel: responsavel || profile?.full_name || 'Sistema',
                motivo: motivo || 'Compra',
                observacoes,
                registrado_por: userId,
                anexo_url: anexoUrl
            })
            .select()
            .single();

        if (error) throw error;

        console.log('🔥 [ENTRADA] Movimentação registrada! ID:', movimentacao.id);
        console.log('🔥 [ENTRADA] Dados recebidos:', { custo_unitario, preco_unitario, quantidade, produto_id });

        // Se foi informado um custo unitário, registrar na tabela de custos
        const custoFinal = custo_unitario || preco_unitario;
        console.log('💰 [CUSTO] custoFinal:', custoFinal, 'quantidade:', quantidade);

        if (custoFinal && parseFloat(custoFinal) > 0) {
            const custoData = {
                produto_id,
                movimentacao_id: movimentacao.id,
                custo_unitario: parseFloat(custoFinal),
                quantidade: parseFloat(quantidade),
                registrado_por: userId
            };
            console.log('💰 [CUSTO] Tentando inserir:', custoData);

            const { data: custoResult, error: custoError } = await supabaseAdmin
                .from('custoslaboratorio')
                .insert(custoData)
                .select();

            if (custoError) {
                console.error('❌ [CUSTO] Erro ao registrar custo:', custoError);
            } else {
                console.log('✅ [CUSTO] Custo registrado com sucesso:', custoResult);
            }
        } else {
            console.log('⚠️ [CUSTO] Custo não informado ou inválido');
        }

        res.json({ success: true, data: movimentacao });
    } catch (error) {
        console.error('Erro ao registrar entrada:', error);
        res.status(500).json({ error: error.message });
    }
});

// Register saida
app.post('/api/laboratorio/movimentacoes/saida', authenticateToken, upload.single('anexo'), async (req, res) => {
    try {
        const {
            produto_id,
            quantidade,
            numero_caso,
            motivo,
            observacoes,
            responsavel
        } = req.body;

        const userId = req.user.id;

        // Process file upload if exists
        let anexoUrl = null;
        if (req.file) {
            const sanitizedName = sanitizeFileName(req.file.originalname);
            const fileName = `movimentacao-saida-${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;

            try {
                // Upload para bucket 'anexos'
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('anexos')
                    .upload(`laboratorio/${fileName}`, req.file.buffer, {
                        contentType: req.file.mimetype,
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Gerar URL pública
                const { data: { publicUrl } } = supabaseAdmin.storage
                    .from('anexos')
                    .getPublicUrl(`laboratorio/${fileName}`);

                anexoUrl = publicUrl;
            } catch (uploadError) {
                console.error('Erro ao fazer upload do anexo:', uploadError);
                throw new Error('Erro ao fazer upload do anexo: ' + uploadError.message);
            }
        }

        // Check available stock
        const { data: estoque } = await supabase
            .from('estoquelaboratorio')
            .select('quantidade_atual')
            .eq('produto_id', produto_id)
            .single();

        if (estoque && estoque.quantidade_atual < quantidade) {
            return res.status(400).json({
                error: 'Estoque insuficiente',
                disponivel: estoque.quantidade_atual,
                solicitado: quantidade
            });
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        const { data: movimentacao, error } = await supabaseAdmin
            .from('movimentacoeslaboratorio')
            .insert({
                produto_id,
                tipo: 'saida',
                quantidade,
                responsavel: responsavel || profile?.full_name || 'Sistema',
                numero_caso,
                motivo: motivo || 'Uso em produção',
                observacoes,
                registrado_por: userId,
                anexo_url: anexoUrl
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data: movimentacao });
    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        res.status(500).json({ error: error.message });
    }
});



// Get alertas stats
app.get('/api/laboratorio/alertas/stats', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('alertaslaboratorio')
            .select('prioridade')
            .eq('resolvido', false);

        if (error) throw error;

        const stats = {
            total: data.length,
            urgente: data.filter(a => a.prioridade === 'urgente').length,
            alta: data.filter(a => a.prioridade === 'alta').length,
            media: data.filter(a => a.prioridade === 'media').length
        };

        res.json(stats);
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mark alerta as visualizado
app.put('/api/laboratorio/alertas/:id/visualizar', authenticateToken, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('alertaslaboratorio')
            .update({
                visualizado: true,
                data_visualizado: new Date().toISOString(),
                visualizado_por: req.user.id
            })
            .eq('id', req.params.id);

        if (error) throw error;

        res.json({ success: true, message: 'Alerta marcado como visualizado' });
    } catch (error) {
        console.error('Erro ao marcar alerta:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resolve alerta
app.put('/api/laboratorio/alertas/:id/resolver', authenticateToken, async (req, res) => {
    try {
        const { observacoes } = req.body;

        const { error } = await supabaseAdmin
            .from('alertaslaboratorio')
            .update({
                resolvido: true,
                data_resolvido: new Date().toISOString(),
                resolvido_por: req.user.id,
                observacoes
            })
            .eq('id', req.params.id);

        if (error) throw error;

        res.json({ success: true, message: 'Alerta resolvido com sucesso' });
    } catch (error) {
        console.error('Erro ao resolver alerta:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get fornecedores list
app.get('/api/laboratorio/fornecedores', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('produtoslaboratorio')
            .select('fornecedor')
            .not('fornecedor', 'is', null)
            .is('deleted_at', null);

        if (error) throw error;

        const fornecedores = [...new Set(data.map(p => p.fornecedor))].filter(Boolean);

        res.json(fornecedores.map(f => ({ fornecedor: f })));
    } catch (error) {
        console.error('Erro ao buscar fornecedores:', error);
        res.status(500).json({ error: error.message });
    }
});

// Relatório: Valor do Estoque
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

// Relatório: Movimentações por Período
app.get('/api/laboratorio/relatorios/movimentacoes', authenticateToken, async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;

        let query = supabase
            .from('vw_movimentacoes_detalhadas')
            .select('*');

        if (dataInicio) query = query.gte('data_movimentacao', dataInicio);
        if (dataFim) {
            const dataFimFinal = new Date(dataFim);
            dataFimFinal.setDate(dataFimFinal.getDate() + 1);
            query = query.lt('data_movimentacao', dataFimFinal.toISOString().split('T')[0]);
        }

        query = query.order('data_movimentacao', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        const totalEntradas = data.filter(m => m.tipo === 'entrada').length;
        const totalSaidas = data.filter(m => m.tipo === 'saida').length;

        res.json({
            movimentacoes: data,
            total_entradas: totalEntradas,
            total_saidas: totalSaidas
        });
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: error.message });
    }
});

// Relatório: Consumo por Responsável
app.get('/api/laboratorio/relatorios/consumo-responsavel', authenticateToken, async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;

        let query = supabase
            .from('movimentacoeslaboratorio')
            .select('responsavel_nome, tipo_movimento')
            .is('deleted_at', null);

        if (dataInicio) query = query.gte('data_movimentacao', dataInicio);
        if (dataFim) {
            const dataFimFinal = new Date(dataFim);
            dataFimFinal.setDate(dataFimFinal.getDate() + 1);
            query = query.lt('data_movimentacao', dataFimFinal.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        if (error) throw error;

        const grouped = data.reduce((acc, mov) => {
            if (!acc[mov.responsavel_nome]) {
                acc[mov.responsavel_nome] = {
                    responsavel_nome: mov.responsavel_nome,
                    total_movimentacoes: 0,
                    total_entradas: 0,
                    total_saidas: 0
                };
            }
            acc[mov.responsavel_nome].total_movimentacoes++;
            if (mov.tipo_movimento === 'entrada') acc[mov.responsavel_nome].total_entradas++;
            if (mov.tipo_movimento === 'saida') acc[mov.responsavel_nome].total_saidas++;
            return acc;
        }, {});

        res.json(Object.values(grouped));
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: error.message });
    }
});

// Relatório: Consumo por Caso Clínico
app.get('/api/laboratorio/relatorios/consumo-caso', authenticateToken, async (req, res) => {
    try {
        const { dataInicio, dataFim, caso } = req.query;

        let query = supabase
            .from('vw_movimentacoes_detalhadas')
            .select('*')
            .eq('tipo_movimento', 'saida')
            .not('caso_clinico', 'is', null);

        if (caso) query = query.ilike('caso_clinico', `%${caso}%`);
        if (dataInicio) query = query.gte('data_movimentacao', dataInicio);
        if (dataFim) {
            const dataFimFinal = new Date(dataFim);
            dataFimFinal.setDate(dataFimFinal.getDate() + 1);
            query = query.lt('data_movimentacao', dataFimFinal.toISOString().split('T')[0]);
        }

        query = query.order('data_movimentacao', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: error.message });
    }
});

// Relatório: Top Produtos
app.get('/api/laboratorio/relatorios/top-produtos', authenticateToken, async (req, res) => {
    try {
        const { dataInicio, dataFim, limit = 10 } = req.query;

        let query = supabase
            .from('movimentacoeslaboratorio')
            .select('produto_id, quantidade')
            .eq('tipo_movimento', 'saida')
            .is('deleted_at', null);

        if (dataInicio) query = query.gte('data_movimentacao', dataInicio);
        if (dataFim) {
            const dataFimFinal = new Date(dataFim);
            dataFimFinal.setDate(dataFimFinal.getDate() + 1);
            query = query.lt('data_movimentacao', dataFimFinal.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Group by produto_id
        const grouped = data.reduce((acc, mov) => {
            if (!acc[mov.produto_id]) {
                acc[mov.produto_id] = {
                    produto_id: mov.produto_id,
                    quantidade_total: 0,
                    numero_movimentacoes: 0
                };
            }
            acc[mov.produto_id].quantidade_total += parseFloat(mov.quantidade);
            acc[mov.produto_id].numero_movimentacoes++;
            return acc;
        }, {});

        const sorted = Object.values(grouped).sort((a, b) => b.quantidade_total - a.quantidade_total).slice(0, parseInt(limit));

        // Get product details
        const produtoIds = sorted.map(p => p.produto_id);
        const { data: produtos } = await supabase
            .from('vw_produtos_estoque')
            .select('*')
            .in('id', produtoIds);

        const result = sorted.map(item => {
            const produto = produtos.find(p => p.id === item.produto_id);
            return {
                ...item,
                produto_nome: produto?.nome_material,
                categoria: produto?.categoria,
                unidade_medida: produto?.unidade_medida
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: error.message });
    }
});

// Relatório: Compras
app.get('/api/laboratorio/relatorios/compras', authenticateToken, async (req, res) => {
    try {
        const { dataInicio, dataFim, fornecedor } = req.query;

        let query = supabase
            .from('custoslaboratorio')
            .select(`
                *,
                produtoslaboratorio!inner (
                    id,
                    nome_material,
                    unidade_medida
                )
            `)
            .is('deleted_at', null);

        if (fornecedor) query = query.ilike('fornecedor', `%${fornecedor}%`);
        if (dataInicio) query = query.gte('data_compra', dataInicio);
        if (dataFim) query = query.lte('data_compra', dataFim);

        query = query.order('data_compra', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        const compras = data.map(c => ({
            ...c,
            produto_nome: c.produtoslaboratorio.nome_material,
            unidade_medida: c.produtoslaboratorio.unidade_medida
        }));

        res.json({ compras });
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: error.message });
    }
});

// Relatório: Entradas do mês
app.get('/api/laboratorio/relatorios/entradas-mes', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('contar_entradas_mes');

        if (error) throw error;

        res.json({ total: data || 0 });
    } catch (error) {
        console.error('Erro ao buscar entradas do mês:', error);
        res.status(500).json({ error: error.message });
    }
});

// Relatório: Saídas do mês
app.get('/api/laboratorio/relatorios/saidas-mes', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('contar_saidas_mes');

        if (error) throw error;

        res.json({ total: data || 0 });
    } catch (error) {
        console.error('Erro ao buscar saídas do mês:', error);
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// EXPORTAÇÃO DE RELATÓRIOS
// =====================================================

// Exportar Relatório de Estoque (CSV)
app.get('/api/laboratorio/relatorios/estoque/export', authenticateToken, async (req, res) => {
    try {
        const { data: produtos, error } = await supabase
            .from('vw_produtos_estoque')
            .select('*')
            .order('nome_material');

        if (error) throw error;

        // Gerar CSV
        const csv = [];
        csv.push('Código,Nome,Categoria,Quantidade,Unidade,Qtd Mínima,Qtd Máxima,Custo Unitário,Valor Total,Data Validade,Localização');

        produtos.forEach(p => {
            const valorTotal = (parseFloat(p.quantidade_atual || 0) * parseFloat(p.custo_unitario || 0)).toFixed(2);
            const dataValidade = p.data_validade ? new Date(p.data_validade).toLocaleDateString('pt-BR') : 'N/A';

            csv.push([
                p.codigo_produto || '',
                `"${p.nome_material || ''}"`,
                p.categoria || '',
                p.quantidade_atual || 0,
                p.unidade_medida || '',
                p.quantidade_minima || 0,
                p.quantidade_maxima || '',
                `€${parseFloat(p.custo_unitario || 0).toFixed(2)}`,
                `€${valorTotal}`,
                dataValidade,
                `"${p.localizacao || ''}"`
            ].join(','));
        });

        const csvContent = csv.join('\n');
        const filename = `relatorio_estoque_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csvContent); // BOM para UTF-8
    } catch (error) {
        console.error('Erro ao exportar relatório de estoque:', error);
        res.status(500).json({ error: error.message });
    }
});

// Exportar Relatório de Movimentações (CSV)
app.get('/api/laboratorio/relatorios/movimentacoes/export', authenticateToken, async (req, res) => {
    try {
        const { data: movimentacoes, error } = await supabase
            .from('vw_movimentacoes_detalhadas')
            .select('*')
            .order('data_movimentacao', { ascending: false })
            .limit(1000);

        if (error) throw error;

        // Gerar CSV
        const csv = [];
        csv.push('Data,Tipo,Produto,Quantidade,Unidade,Responsável,Caso/Procedimento,Fornecedor,Número Pedido,Observações');

        movimentacoes.forEach(m => {
            const data = new Date(m.data_movimentacao).toLocaleDateString('pt-BR') + ' ' + new Date(m.data_movimentacao).toLocaleTimeString('pt-BR');
            const tipo = m.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA';

            csv.push([
                data,
                tipo,
                `"${m.nome_material || ''}"`,
                m.quantidade || 0,
                m.unidade_medida || '',
                `"${m.nome_responsavel || ''}"`,
                `"${m.caso_procedimento || ''}"`,
                `"${m.fornecedor || ''}"`,
                `"${m.numero_pedido || ''}"`,
                `"${m.observacoes || ''}"`
            ].join(','));
        });

        const csvContent = csv.join('\n');
        const filename = `relatorio_movimentacoes_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csvContent);
    } catch (error) {
        console.error('Erro ao exportar relatório de movimentações:', error);
        res.status(500).json({ error: error.message });
    }
});

// Exportar Análise de Valor (CSV)
app.get('/api/laboratorio/relatorios/valor/export', authenticateToken, async (req, res) => {
    try {
        const { data: produtos, error } = await supabase
            .from('vw_produtos_estoque')
            .select('*')
            .order('categoria');

        if (error) throw error;

        // Agrupar por categoria
        const categorias = {};
        let totalGeral = 0;

        produtos.forEach(p => {
            const categoria = p.categoria || 'Sem Categoria';
            const valorProduto = parseFloat(p.quantidade_atual || 0) * parseFloat(p.custo_unitario || 0);

            if (!categorias[categoria]) {
                categorias[categoria] = {
                    produtos: [],
                    total: 0
                };
            }

            categorias[categoria].produtos.push({
                nome: p.nome_material,
                quantidade: p.quantidade_atual,
                unidade: p.unidade_medida,
                custoUnitario: p.custo_unitario,
                valorTotal: valorProduto
            });

            categorias[categoria].total += valorProduto;
            totalGeral += valorProduto;
        });

        // Gerar CSV
        const csv = [];
        csv.push('Categoria,Produto,Quantidade,Unidade,Custo Unitário,Valor Total');

        Object.keys(categorias).sort().forEach(categoria => {
            const cat = categorias[categoria];

            cat.produtos.forEach((p, index) => {
                csv.push([
                    index === 0 ? categoria : '',
                    `"${p.nome}"`,
                    p.quantidade || 0,
                    p.unidade || '',
                    `€${parseFloat(p.custoUnitario || 0).toFixed(2)}`,
                    `€${p.valorTotal.toFixed(2)}`
                ].join(','));
            });

            csv.push([
                '',
                `SUBTOTAL ${categoria}`,
                '',
                '',
                '',
                `€${cat.total.toFixed(2)}`
            ].join(','));
            csv.push('');
        });

        csv.push([
            '',
            'TOTAL GERAL',
            '',
            '',
            '',
            `€${totalGeral.toFixed(2)}`
        ].join(','));

        const csvContent = csv.join('\n');
        const filename = `analise_valor_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csvContent);
    } catch (error) {
        console.error('Erro ao exportar análise de valor:', error);
        res.status(500).json({ error: error.message });
    }
});

// Exportar Análise de Consumo (CSV)
app.get('/api/laboratorio/relatorios/consumo/export', authenticateToken, async (req, res) => {
    try {
        // Últimos 30 dias
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - 30);

        const { data: movimentacoes, error } = await supabase
            .from('vw_movimentacoes_detalhadas')
            .select('*')
            .eq('tipo', 'saida')
            .gte('data_movimentacao', dataInicio.toISOString())
            .order('data_movimentacao', { ascending: false });

        if (error) throw error;

        // Agrupar por produto
        const produtos = {};

        movimentacoes.forEach(m => {
            const produtoId = m.produto_id;
            const nomeProduto = m.nome_material;

            if (!produtos[produtoId]) {
                produtos[produtoId] = {
                    nome: nomeProduto,
                    unidade: m.unidade_medida,
                    quantidadeTotal: 0,
                    numeroSaidas: 0
                };
            }

            produtos[produtoId].quantidadeTotal += parseFloat(m.quantidade || 0);
            produtos[produtoId].numeroSaidas += 1;
        });

        // Converter para array e ordenar por quantidade
        const produtosArray = Object.values(produtos).sort((a, b) => b.quantidadeTotal - a.quantidadeTotal);

        // Gerar CSV
        const csv = [];
        csv.push('Posição,Produto,Quantidade Consumida,Unidade,Número de Saídas,Média por Saída');

        produtosArray.forEach((p, index) => {
            const mediaPorSaida = p.quantidadeTotal / p.numeroSaidas;

            csv.push([
                index + 1,
                `"${p.nome}"`,
                p.quantidadeTotal.toFixed(2),
                p.unidade || '',
                p.numeroSaidas,
                mediaPorSaida.toFixed(2)
            ].join(','));
        });

        csv.push('');
        csv.push(`"Período: ${dataInicio.toLocaleDateString('pt-BR')} até ${new Date().toLocaleDateString('pt-BR')}"`);
        csv.push(`"Total de produtos: ${produtosArray.length}"`);

        const csvContent = csv.join('\n');
        const filename = `analise_consumo_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + csvContent);
    } catch (error) {
        console.error('Erro ao exportar análise de consumo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ORDENS DE SERVIÇO - NOVO MÓDULO ====================

// Rotas principais de CRUD
app.get('/api/prostoral/orders', authenticateToken, prostoralOrders.listOrders);
app.get('/api/prostoral/orders/:id', authenticateToken, prostoralOrders.getOrderDetails);
app.post('/api/prostoral/orders', authenticateToken, prostoralOrders.createOrder);
app.put('/api/prostoral/orders/:id', authenticateToken, prostoralOrders.updateOrder);
app.post('/api/prostoral/orders/:id/attachments', authenticateToken, upload.array('files'), prostoralOrders.addAttachments);
app.delete('/api/prostoral/orders/:id/attachments/:attachmentId', authenticateToken, prostoralOrders.deleteAttachment);
app.delete('/api/prostoral/orders/:id', authenticateToken, prostoralOrders.deleteOrder);

// Rotas de Materiais
app.post('/api/prostoral/orders/:id/materials', authenticateToken, prostoralOrders.addMaterial);
app.post('/api/prostoral/orders/:id/materials/kit', authenticateToken, prostoralOrders.addKit);
app.delete('/api/prostoral/orders/:id/materials/:materialId', authenticateToken, prostoralOrders.removeMaterial);

// Rotas de Time Tracking
app.post('/api/prostoral/orders/:id/time-tracking', authenticateToken, prostoralOrders.startTimeTracking);
app.put('/api/prostoral/orders/:id/time-tracking/:trackingId', authenticateToken, prostoralOrders.updateTimeTracking);
app.get('/api/prostoral/orders/:id/time-tracking', authenticateToken, prostoralOrders.listTimeTracking);

// Rotas de Intercorrências/Issues
app.post('/api/prostoral/orders/:id/issues', authenticateToken, prostoralOrders.createIssue);
app.put('/api/prostoral/orders/:id/issues/:issueId', authenticateToken, prostoralOrders.updateIssue);
app.get('/api/prostoral/orders/:id/issues', authenticateToken, prostoralOrders.listIssues);

// Rota de Histórico
app.get('/api/prostoral/orders/:id/history', authenticateToken, prostoralOrders.getOrderHistory);

// Rotas de Reparo
app.post('/api/prostoral/orders/:id/repair', authenticateToken, prostoralOrders.createRepairOrder);
app.get('/api/prostoral/orders/:id/related', authenticateToken, prostoralOrders.getRelatedOrders);

// ==================== PORTAL DO CLIENTE ====================
// Rotas exclusivas para clientes (acesso restrito)
app.get('/api/prostoral/check-client-role', authenticateToken, prostoralClients.checkClientRole);
app.get('/api/prostoral/client/dashboard/kpis', authenticateToken, prostoralClients.getClientDashboardKPIs);
app.get('/api/prostoral/client/orders/recent', authenticateToken, prostoralClients.getClientRecentOrders);
app.get('/api/prostoral/client/orders', authenticateToken, prostoralClients.listClientOrders);
app.get('/api/prostoral/client/orders/:id', authenticateToken, prostoralClients.getClientOrderDetails);
app.post('/api/prostoral/client/orders', authenticateToken, prostoralClients.createClientOrder);
app.post('/api/prostoral/client/orders/:id/issues', authenticateToken, prostoralClients.createClientIssue);
app.post('/api/prostoral/client/orders/:id/attachments', authenticateToken, upload.array('files'), prostoralOrders.addAttachments);
app.delete('/api/prostoral/client/orders/:id/attachments/:attachmentId', authenticateToken, prostoralOrders.deleteAttachment);

// Rotas POST para gerenciamento de clientes (já declaradas acima junto com GET)
app.post('/api/prostoral/clients/link-user', authenticateToken, prostoralClients.linkUserToClient);
app.post('/api/prostoral/clients/unlink-user', authenticateToken, prostoralClients.unlinkUserFromClient);

// Middleware de tratamento de erros 404 - deve vir ANTES do error handler
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        path: req.path
    });
});

// Middleware de tratamento de erros globais
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno'
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log(`🔗 Supabase URL: ${supabaseUrl}`);
    console.log(`🌟 Sistema de Inventário - Grupo AreLuna`);
});

// Tratamento de sinais para encerramento gracioso
process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, encerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, encerrando servidor...');
    process.exit(0);
});

module.exports = app;