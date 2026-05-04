import express from 'express';
import {
  applyToJob, getCandidateApplications,
  getJobApplications, updateApplicationStatus,
  autoScreenApplications, autoScreenAllApplications, deleteApplication,
} from '../controllers/applicationController.js';
import { authenticate, requireEmployer, requireCandidate } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticate, requireCandidate, applyToJob);
router.get('/mine', authenticate, requireCandidate, getCandidateApplications);
router.get('/job/:job_id', authenticate, requireEmployer, getJobApplications);
router.put('/:id/status', authenticate, requireEmployer, updateApplicationStatus);

// Auto-screen pending applications for a specific job
router.post('/job/:job_id/auto-screen', authenticate, requireEmployer, autoScreenApplications);
// Auto-screen ALL pending applications across all employer jobs
router.post('/auto-screen-all', authenticate, requireEmployer, autoScreenAllApplications);
// Delete a rejected application
router.delete('/:id', authenticate, requireEmployer, deleteApplication);

export default router;
