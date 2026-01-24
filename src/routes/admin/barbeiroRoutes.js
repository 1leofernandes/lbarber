const express = require('express');
const router = express.Router();
const AdminBarbeiroController = require('../../controllers/admin/barbeiroController');

// GET /admin/barbeiros - Listar todos os barbeiros
router.get('/', AdminBarbeiroController.getAll);

// GET /admin/barbeiros/clientes-para-promover - Listar clientes que podem ser promovidos
router.get('/clientes-para-promover', AdminBarbeiroController.getClientesParaPromover);

// GET /admin/barbeiros/:id - Buscar barbeiro por ID
router.get('/:id', AdminBarbeiroController.getById);

// GET /admin/barbeiros/:id/estatisticas - Buscar estatísticas do barbeiro
router.get('/:id/estatisticas', AdminBarbeiroController.getEstatisticas);

// POST /admin/barbeiros - Criar novo barbeiro
router.post('/', AdminBarbeiroController.create);

// POST /admin/barbeiros/promover - Promover cliente a barbeiro
router.post('/promover', AdminBarbeiroController.promoverUsuario);

// PUT /admin/barbeiros/:id - Atualizar barbeiro
router.put('/:id', AdminBarbeiroController.update);

// PUT /admin/barbeiros/:id/rebaixar - Rebaixar barbeiro a cliente
router.put('/:id/rebaixar', AdminBarbeiroController.rebaixarBarbeiro);

// DELETE /admin/barbeiros/:id - Excluir barbeiro
router.delete('/:id', AdminBarbeiroController.delete);

module.exports = router;