// ============================================
// AUTH + USER MANAGEMENT ROUTES
// ============================================

import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as userController from '../controllers/user.controller';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.middleware';
import { loginRateLimiter, passwordRateLimiter, refreshTokenRateLimiter } from '../middleware/rateLimiter.middleware';
import { validateBody } from '../middleware/validate.middleware';
import {
  changePasswordSchema,
  refreshTokenSchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} from '../validators/schemas';

const router = Router();

// ── Authentication (Public) ────────────────────────────────────────────────
// Local login removed (Phase 3) — SSO-only authentication via Google OAuth
router.post('/auth/google', loginRateLimiter, authController.googleLogin);
router.post('/auth/logout', optionalAuth, authController.logout);
router.post('/auth/refresh', refreshTokenRateLimiter, validateBody(refreshTokenSchema), authController.refreshAccessToken);
router.get('/auth/profile', authenticateToken, authController.getProfile);
router.post('/auth/change-password', authenticateToken, passwordRateLimiter, validateBody(changePasswordSchema), authController.changePassword);

// ── User Management (Protected) ───────────────────────────────────────────
router.get('/users', authenticateToken, requireRole('ADMIN', 'MANAGER'), userController.getAllUsers);
router.get('/users/:user_id', authenticateToken, requireRole('ADMIN', 'MANAGER'), userController.getUserById);
router.post('/users', authenticateToken, requireRole('ADMIN'), validateBody(createUserSchema), userController.createUser);
router.put('/users/:user_id', authenticateToken, requireRole('ADMIN'), validateBody(updateUserSchema), userController.updateUser);
router.delete('/users/:user_id', authenticateToken, requireRole('ADMIN'), userController.deleteUser);
router.post('/users/:user_id/reset-password', authenticateToken, requireRole('ADMIN'), validateBody(resetPasswordSchema), userController.resetUserPassword);
router.get('/users/:user_id/audit-logs', authenticateToken, requireRole('ADMIN', 'MANAGER'), userController.getUserAuditLogs);

export default router;
