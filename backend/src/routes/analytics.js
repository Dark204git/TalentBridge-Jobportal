import express from 'express';
import { getEmployerDashboard, getEmployerAnalytics, getCandidateAnalytics } from '../controllers/analyticsController.js';
import { authenticate, requireEmployer, requireCandidate } from '../middleware/auth.js';

const router = express.Router();

router.get('/employer/dashboard', authenticate, requireEmployer, getEmployerDashboard);
router.get('/employer',           authenticate, requireEmployer, getEmployerAnalytics);
router.get('/candidate',          authenticate, requireCandidate, getCandidateAnalytics);

export default router;