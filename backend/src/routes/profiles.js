import express from 'express';
import {
  getCandidateProfile, updateCandidateProfile,
  getEmployerProfile, updateEmployerProfile,
  saveJob, getSavedJobs,
  uploadProfilePicture, confirmProfilePicture,
} from '../controllers/profileController.js';
import {
  getUploadUrl, confirmResumeUpload, getResumeParseStatus
} from '../controllers/resumeController.js';
import { authenticate, requireEmployer, requireCandidate } from '../middleware/auth.js';

const router = express.Router();

// Candidate
router.get('/candidate', authenticate, requireCandidate, getCandidateProfile);
router.put('/candidate', authenticate, requireCandidate, updateCandidateProfile);
router.get('/candidate/saved-jobs', authenticate, requireCandidate, getSavedJobs);
router.post('/candidate/save-job', authenticate, requireCandidate, saveJob);

// Profile picture upload (presign → upload direct to R2 → confirm)
router.post('/candidate/picture/upload-url', authenticate, requireCandidate, uploadProfilePicture);
router.post('/candidate/picture/confirm',    authenticate, requireCandidate, confirmProfilePicture);

// Resume
router.post('/resume/upload-url', authenticate, requireCandidate, getUploadUrl);
router.post('/resume/confirm', authenticate, requireCandidate, confirmResumeUpload);
router.get('/resume/status', authenticate, requireCandidate, getResumeParseStatus);

// Employer
router.get('/employer', authenticate, requireEmployer, getEmployerProfile);
router.put('/employer', authenticate, requireEmployer, updateEmployerProfile);

export default router;