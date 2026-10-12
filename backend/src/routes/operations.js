const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { wrap, badRequest } = require('../utils/errors');
const inventory = require('../services/inventory');
const purchasing = require('../services/purchasing');

router.use(authenticate);

const STAFF = ['Warehouse Staff', 'Warehouse Manager'];

router.post('/receipts', authorize(...STAFF), wrap(async (req, res) => res.status(201).json(await inventory.receiveStock(req.user, req.body || {}))));
router.post('/issues', authorize(...STAFF), wrap(async (req, res) => res.status(201).json(await inventory.issueStock(req.user, req.body || {}))));
router.post('/transfers', authorize(...STAFF), wrap(async (req, res) => res.status(201).json(await inventory.transferStock(req.user, req.body || {}))));
router.post('/stock-adjustments', authorize('Warehouse Manager'), wrap(async (req, res) => res.status(201).json(await inventory.adjustStock(req.user, req.body || {}))));

router.get('/purchase-orders', wrap(async (req, res) => res.json(await purchasing.listPurchaseOrders(req.query))));
router.get('/purchase-orders/:id', wrap(async (req, res) => res.json(await purchasing.getPurchaseOrder(req.params.id))));
router.post('/purchase-orders', authorize('Purchasing Staff'), wrap(async (req, res) => res.status(201).json(await purchasing.createPurchaseOrder(req.user, req.body || {}))));
router.patch('/purchase-orders/:id/status', wrap(async (req, res, next) => {
  const status = req.body && req.body.status;
  // Approving needs a manager; submitting/cancelling is for purchasing staff or manager.
  const allowed = status === 'APPROVED' ? ['Warehouse Manager'] : ['Purchasing Staff', 'Warehouse Manager'];
  if (!status) throw badRequest('Choose a status.');
  authorize(...allowed)(req, res, async (err) => {
    if (err) return next(err);
    try { res.json(await purchasing.changeStatus(req.user, req.params.id, status)); } catch (e) { next(e); }
  });
}));

module.exports = router;
