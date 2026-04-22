import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createCategory,
  createItem,
  deleteCategory,
  deleteItem,
  listMenu,
  publicMenu,
  toggleAvailability,
  updateCategory,
  updateItem,
} from '../controllers/menu.controller.js';

const router = Router();
const publicRouter = Router();

// Public (no auth)
publicRouter.get('/public/:slug', publicMenu);

// Authenticated
router.use(requireAuth);
router.get('/', listMenu);
router.post('/items', requireRole('OWNER', 'MANAGER'), createItem);
router.put('/items/:id', requireRole('OWNER', 'MANAGER'), updateItem);
router.delete('/items/:id', requireRole('OWNER', 'MANAGER'), deleteItem);
router.put('/items/:id/availability', toggleAvailability);
router.post('/categories', requireRole('OWNER', 'MANAGER'), createCategory);
router.put('/categories/:id', requireRole('OWNER', 'MANAGER'), updateCategory);
router.delete('/categories/:id', requireRole('OWNER', 'MANAGER'), deleteCategory);

export { publicRouter };
export default router;
