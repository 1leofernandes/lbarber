const express = require('express');
const router = express.Router();
const mp = require('./src/config/mercadoPago');

router.post('/cancelar-teste', async (req, res) => {
    try {
        const { preapprovalId } = req.body;
        
        const result = await mp.cancelSubscription(preapprovalId);
        
        res.json({ 
            success: true, 
            message: 'Assinatura cancelada',
            data: result 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});