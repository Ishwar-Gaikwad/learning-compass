import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { validateRegisterInput, validateLoginInput } from '../middleware/validate.middleware.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', validateRegisterInput, register);
router.post('/login', validateLoginInput, login);
router.get('/me', protect, getMe);

export default router;
