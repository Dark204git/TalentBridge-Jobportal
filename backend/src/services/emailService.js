import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'TalentBridge <noreply@talentbridge.app>';
const APP_NAME = process.env.APP_NAME || 'TalentBridge';

const baseStyle = `
  font-family: 'Segoe UI', Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background: #ffffff;
`;

const header = `
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: #f0c040; margin: 0; font-size: 28px; letter-spacing: 2px;">${APP_NAME}</h1>
    <p style="color: #a0aec0; margin: 8px 0 0 0; font-size: 14px;">Your Career Bridge</p>
  </div>
`;

const footer = `
  <div style="background: #f7fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
    <p style="color: #718096; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
    <p style="color: #a0aec0; font-size: 11px; margin: 8px 0 0 0;">You're receiving this because you have an account on ${APP_NAME}</p>
  </div>
`;

export const sendWelcomeEmail = async (email, name, role) => {
  const html = `
    <div style="${baseStyle}">
      ${header}
      <div style="padding: 32px;">
        <h2 style="color: #2d3748;">Welcome aboard, ${name}! 🎉</h2>
        <p style="color: #4a5568; line-height: 1.6;">
          We're thrilled to have you join ${APP_NAME} as a ${role}.
        </p>
        ${role === 'candidate' ? `
          <p style="color: #4a5568;">Here's what you can do next:</p>
          <ul style="color: #4a5568; line-height: 2;">
            <li>Complete your profile to stand out</li>
            <li>Upload your resume for smart matching</li>
            <li>Browse thousands of job opportunities</li>
          </ul>
        ` : `
          <p style="color: #4a5568;">Here's what you can do next:</p>
          <ul style="color: #4a5568; line-height: 2;">
            <li>Set up your company profile</li>
            <li>Post your first job listing</li>
            <li>Access your hiring dashboard</li>
          </ul>
        `}
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.FRONTEND_URL}" 
            style="background: #f0c040; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Get Started →
          </a>
        </div>
      </div>
      ${footer}
    </div>
  `;

  return resend.emails.send({
    from: FROM, to: email,
    subject: `Welcome to ${APP_NAME}!`,
    html
  });
};

export const sendApplicationReceivedEmail = async (employerEmail, employerName, candidateName, jobTitle) => {
  const html = `
    <div style="${baseStyle}">
      ${header}
      <div style="padding: 32px;">
        <h2 style="color: #2d3748;">New Application Received 📋</h2>
        <p style="color: #4a5568;">Hi ${employerName},</p>
        <p style="color: #4a5568; line-height: 1.6;">
          <strong>${candidateName}</strong> has applied for your <strong>${jobTitle}</strong> position.
        </p>
        <div style="background: #f7fafc; border-left: 4px solid #f0c040; padding: 16px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #2d3748; font-weight: bold;">Review their application in your dashboard to take action.</p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.FRONTEND_URL}/employer/applications" 
            style="background: #f0c040; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View Application →
          </a>
        </div>
      </div>
      ${footer}
    </div>
  `;

  return resend.emails.send({
    from: FROM, to: employerEmail,
    subject: `New application for ${jobTitle} from ${candidateName}`,
    html
  });
};

export const sendApplicationStatusEmail = async (candidateEmail, candidateName, jobTitle, status) => {
  const statusMessages = {
    reviewing: { emoji: '👀', text: 'Your application is being reviewed', color: '#3182ce' },
    shortlisted: { emoji: '⭐', text: 'Exciting news — you\'ve been shortlisted!', color: '#38a169' },
    interviewed: { emoji: '🤝', text: 'You\'ve been selected for an interview', color: '#805ad5' },
    offered: { emoji: '🎉', text: 'Congratulations! You have a job offer!', color: '#d69e2e' },
    rejected: { emoji: '📩', text: 'Thank you for your application', color: '#718096' },
  };

  const msg = statusMessages[status] || { emoji: '📬', text: 'Your application status has been updated', color: '#4a5568' };

  const html = `
    <div style="${baseStyle}">
      ${header}
      <div style="padding: 32px;">
        <h2 style="color: ${msg.color};">${msg.emoji} ${msg.text}</h2>
        <p style="color: #4a5568;">Hi ${candidateName},</p>
        <p style="color: #4a5568; line-height: 1.6;">
          Your application for <strong>${jobTitle}</strong> has been updated to: 
          <span style="color: ${msg.color}; font-weight: bold; text-transform: capitalize;">${status}</span>
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.FRONTEND_URL}/candidate/applications" 
            style="background: #f0c040; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View All Applications →
          </a>
        </div>
      </div>
      ${footer}
    </div>
  `;

  return resend.emails.send({
    from: FROM, to: candidateEmail,
    subject: `Application update: ${jobTitle} — ${status}`,
    html
  });
};

export const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = `
    <div style="${baseStyle}">
      ${header}
      <div style="padding: 32px;">
        <h2 style="color: #2d3748;">🔐 Reset Your Password</h2>
        <p style="color: #4a5568;">Hi ${name},</p>
        <p style="color: #4a5568; line-height: 1.6;">
          We received a request to reset your password. Click the button below to create a new one.
          This link expires in <strong>1 hour</strong>.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}"
            style="background: #f0c040; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Reset Password →
          </a>
        </div>
        <p style="color: #a0aec0; font-size: 13px; text-align: center;">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
      </div>
      ${footer}
    </div>
  `;
  return resend.emails.send({
    from: FROM, to: email,
    subject: `Reset your ${APP_NAME} password`,
    html
  });
};

export const sendNewJobMatchEmail = async (candidateEmail, candidateName, jobTitle, matchScore) => {
  const html = `
    <div style="${baseStyle}">
      ${header}
      <div style="padding: 32px;">
        <h2 style="color: #2d3748;">🎯 New Job Match Found!</h2>
        <p style="color: #4a5568;">Hi ${candidateName},</p>
        <p style="color: #4a5568; line-height: 1.6;">
          We found a job that matches your profile: <strong>${jobTitle}</strong>
        </p>
        <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="color: #a0aec0; margin: 0 0 8px 0; font-size: 14px;">Match Score</p>
          <p style="color: #f0c040; font-size: 48px; font-weight: bold; margin: 0;">${matchScore}%</p>
        </div>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${process.env.FRONTEND_URL}/jobs" 
            style="background: #f0c040; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View Job →
          </a>
        </div>
      </div>
      ${footer}
    </div>
  `;

  return resend.emails.send({
    from: FROM, to: candidateEmail,
    subject: `${matchScore}% match: ${jobTitle}`,
    html
  });
};