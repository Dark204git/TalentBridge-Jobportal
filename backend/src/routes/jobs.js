
import express from 'express';
import {
  createJob, getJobs, getJobById, updateJob,
  deleteJob, permanentDeleteJob, getEmployerJobs, getMatchingCandidates,
} from '../controllers/jobController.js';
import { authenticate, requireEmployer, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getJobs);
router.get('/employer/mine', authenticate, requireEmployer, getEmployerJobs);
router.get('/:id', optionalAuth, getJobById);
router.get('/:id/matching-candidates', authenticate, requireEmployer, getMatchingCandidates);
router.post('/', authenticate, requireEmployer, createJob);
router.put('/:id', authenticate, requireEmployer, updateJob);
router.delete('/:id', authenticate, requireEmployer, deleteJob);
router.delete('/:id/permanent', authenticate, requireEmployer, permanentDeleteJob);

export default router;