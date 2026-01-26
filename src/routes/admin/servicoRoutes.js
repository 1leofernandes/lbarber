const express = require('express');
const router = express.Router();
const ServicoController = require('../../controllers/admin/servicoController');

// GET /admin/servicos - Listar todos os serviços
router.get('/', ServicoController.getAll);

// GET /admin/servicos/:id - Buscar serviço por ID
router.get('/:id', ServicoController.getById);

// POST /admin/servicos - Criar novo serviço
router.post('/', ServicoController.create);

// PUT /admin/servicos/:id - Atualizar serviço
router.put('/:id', ServicoController.update);

// DELETE /admin/servicos/:id - Excluir serviço
router.delete('/:id', ServicoController.delete);

// PUT /admin/servicos/:id/status - Ativar/desativar serviço
router.put('/:id/status', ServicoController.updateStatus);

// GET /admin/servicos/estatisticas/geral - Estatísticas dos serviços
router.get('/estatisticas/geral', ServicoController.getEstatisticas);

module.exports = router;