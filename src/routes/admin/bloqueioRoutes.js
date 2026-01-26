const express = require('express');
const router = express.Router();
const BloqueioController = require('../../controllers/admin/bloqueioController');

// GET /admin/bloqueios - Listar todos os bloqueios
router.get('/', BloqueioController.getAll);

// GET /admin/bloqueios/:id - Buscar bloqueio por ID
router.get('/:id', BloqueioController.getById);

// POST /admin/bloqueios - Criar novo bloqueio
router.post('/', BloqueioController.create);

// PUT /admin/bloqueios/:id - Atualizar bloqueio
router.put('/:id', BloqueioController.update);

// DELETE /admin/bloqueios/:id - Excluir bloqueio
router.delete('/:id', BloqueioController.delete);

// PUT /admin/bloqueios/:id/status - Ativar/desativar bloqueio
router.put('/:id/status', BloqueioController.toggleStatus);

// GET /admin/bloqueios/verificar-disponibilidade - Verificar disponibilidade
router.get('/verificar-disponibilidade', BloqueioController.verificarDisponibilidade);

module.exports = router;