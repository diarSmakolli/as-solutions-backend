const express = require('express');
const router = express.Router();
const TaxController = require('./tax.controller');
const authGuard = require('../../guards/auth.guard');
const roleGuard = require('../../guards/role.guard');

router.post('/create-tax', authGuard, roleGuard("global-administrator", "administrator"), TaxController.createTax);
router.put('/edit-tax/:taxId', authGuard, roleGuard("global-administrator", "administrator"), TaxController.editTax);
router.delete('/delete-tax/:taxId', authGuard, roleGuard("global-administrator", "administrator"), TaxController.deleteTax);
router.get('/get-taxes', authGuard, roleGuard("global-administrator", "administrator"), TaxController.getAllTaxesList);

module.exports = router;