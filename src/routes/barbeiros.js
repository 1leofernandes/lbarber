// Rotas de barbeiros
const express = require('express');
const router = express.Router();
const BarberController = require('../controllers/barberController');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');

// GET /barbeiros - Listar barbeiros
router.get('/', BarberController.getAllBarbeiros);

// DELETE /barbeiros/:id - Deletar barbeiro (apenas admin)
router.delete('/:id', authenticateToken, authorizeRole('admin'), BarberController.deleteBarbeiro);

module.exports = router;
