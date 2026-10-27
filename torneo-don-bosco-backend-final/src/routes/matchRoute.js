import { Router } from 'express';
import * as controller from '../controllers/matchController.js';
import { verifyToken, allowRoles } from '../middleware/verifyToken.js';

const router = Router();
const writer = [verifyToken, allowRoles('admin', 'organizador')];
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', writer, controller.create);
router.patch('/:id', writer, controller.update);
router.delete('/:id', verifyToken, allowRoles('admin'), controller.remove);
export default router;
