import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/',                    authenticate, getNotifications);
router.patch('/read-all',          authenticate, markAllAsRead);
router.patch('/:id/read',          authenticate, markAsRead);
router.delete('/',                 authenticate, clearAll);
router.delete('/:id',              authenticate, deleteNotification);

export default router;
