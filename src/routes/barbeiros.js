// Rotas de barbeiros
const express = require('express');
const router = express.Router();
const barbeiroController = require('../controllers/barbeiroController');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// GET /barbeiros - Buscar todos os barbeiros
router.get('/', barbeiroController.getAll);

// GET /barbeiros/:id - Buscar barbeiro por ID
router.get('/:id', barbeiroController.getById);

// DELETE /barbeiros/:id - Deletar barbeiro (apenas admin)
router.delete('/:id', authenticateToken, authorizeRole('admin'), barbeiroController.deleteBarbeiro);

module.exports = router;
