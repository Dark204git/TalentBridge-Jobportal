import { supabase } from '../config/supabase.js';

// ── Employer Dashboard — action-focused, "what needs attention today" ─────────
export const getEmployerDashboard = async (req, res) => {
  try {
    const employerId = req.user.id;
    const now        = new Date();

    // ── Summary counts ────────────────────────────────────────────────────────
    const [
      { count: totalJobs },
      { count: activeJobs },
      { count: totalApplications },
    ] = await Promise.all([
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('employer_id', employerId),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('employer_id', employerId).eq('status', 'active'),
      supabase.from('applications').select('*', { count: 'exact', head: true }).eq('employer_id', employerId),
    ]);

    // New applications received today
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const { count: newToday } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', employerId)
      .gte('applied_at', todayStart.toISOString());

    // Applications by status
    const { data: appsByStatus } = await supabase
      .from('applications').select('status').eq('employer_id', employerId);
    const statusCounts = (appsByStatus || []).reduce((acc, { status }) => {
      acc[status] = (acc[status] || 0) + 1; return acc;
    }, {});

    // Pending applications older than 5 days (need action)
    const fiveDaysAgo = new Date(now);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const { count: stalePending } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', employerId)
      .eq('status', 'pending')
      .lte('applied_at', fiveDaysAgo.toISOString());

    // Jobs expiring within 7 days (include jobs whose deadline is today)
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);
    in7Days.setHours(23, 59, 59, 999);
    const { data: expiringJobs } = await supabase
      .from('jobs')
      .select('id, title, application_deadline')
      .eq('employer_id', employerId)
      .eq('status', 'active')
      .not('application_deadline', 'is', null)
      .gte('application_deadline', startOfToday.toISOString())
      .lte('application_deadline', in7Days.toISOString())
      .order('application_deadline', { ascending: true });

    // Recent jobs (last 5) with application counts
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('id, title, views, created_at, status, application_deadline')
      .eq('employer_id', employerId)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentJobsWithApps = await Promise.all(
      (recentJobs || []).map(async (job) => {
        const { count } = await supabase
          .from('applications').select('*', { count: 'exact', head: true }).eq('job_id', job.id);
        return { ...job, applicationCount: count || 0 };
      })
    );

    res.json({
      summary:      { totalJobs, activeJobs, totalApplications, newToday },
      applicationsByStatus: statusCounts,
      urgentActions: { stalePending: stalePending || 0, expiringJobs: expiringJobs || [] },
      recentJobs:   recentJobsWithApps,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// ── Employer Analytics — performance-focused, historical depth ────────────────
export const getEmployerAnalytics = async (req, res) => {
  try {
    const employerId = req.user.id;

    // ── Performance KPIs ──────────────────────────────────────────────────────
    const { data: viewData } = await supabase
      .from('jobs').select('views').eq('employer_id', employerId);
    const totalViews = (viewData || []).reduce((sum, j) => sum + (j.views || 0), 0);

    // Average time-to-hire: avg days from applied_at to updated_at for offered apps
    const { data: offeredApps } = await supabase
      .from('applications')
      .select('applied_at, updated_at')
      .eq('employer_id', employerId)
      .eq('status', 'offered');

    let avgTimeToHire = null;
    if (offeredApps?.length) {
      const totalDays = offeredApps.reduce((sum, a) => {
        const diff = new Date(a.updated_at) - new Date(a.applied_at);
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0);
      avgTimeToHire = Math.round(totalDays / offeredApps.length);
    }

    // Offer acceptance rate: offered / (offered + rejected after interview)
    const { data: allApps } = await supabase
      .from('applications').select('status, match_score').eq('employer_id', employerId);

    const offeredCount    = (allApps || []).filter(a => a.status === 'offered').length;
    const interviewedCount = (allApps || []).filter(a => ['interviewed', 'offered', 'rejected'].includes(a.status)).length;
    const offerRate = interviewedCount > 0 ? Math.round((offeredCount / interviewedCount) * 100) : null;

    // Average match score across all applications that have one
    const scored = (allApps || []).filter(a => a.match_score != null);
    const avgMatchScore = scored.length
      ? Math.round(scored.reduce((s, a) => s + a.match_score, 0) / scored.length)
      : null;

    // ── Weekly application trend (last 8 weeks, real date labels) ────────────
    const weeklyTrend = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const { count } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('employer_id', employerId)
        .gte('applied_at', start.toISOString())
        .lte('applied_at', end.toISOString());

      // Label as "Apr 7" (start of window)
      const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weeklyTrend.push({ week: label, applications: count || 0 });
    }

    // ── Application funnel ────────────────────────────────────────────────────
    const FUNNEL_ORDER = ['pending', 'reviewing', 'shortlisted', 'interviewed', 'offered'];
    const statusCounts = (allApps || []).reduce((acc, { status }) => {
      acc[status] = (acc[status] || 0) + 1; return acc;
    }, {});
    const total = allApps?.length || 1;
    const funnel = FUNNEL_ORDER.map(stage => ({
      stage,
      count: statusCounts[stage] || 0,
      pct:   Math.round(((statusCounts[stage] || 0) / total) * 100),
    }));

    // ── Match score distribution ──────────────────────────────────────────────
    const buckets = { '0–30': 0, '31–60': 0, '61–80': 0, '81–100': 0 };
    for (const { match_score } of (allApps || [])) {
      if (match_score == null) continue;
      if (match_score <= 30)       buckets['0–30']++;
      else if (match_score <= 60)  buckets['31–60']++;
      else if (match_score <= 80)  buckets['61–80']++;
      else                         buckets['81–100']++;
    }
    const scoreDistribution = Object.entries(buckets).map(([range, count]) => ({ range, count }));

    // ── Job performance (all jobs, not just last 5) ───────────────────────────
    const { data: allJobs } = await supabase
      .from('jobs')
      .select('id, title, views, created_at, status, application_deadline')
      .eq('employer_id', employerId)
      .order('created_at', { ascending: false });

    const jobPerformance = await Promise.all(
      (allJobs || []).map(async (job) => {
        const { data: jobApps } = await supabase
          .from('applications')
          .select('status, match_score')
          .eq('job_id', job.id);

        const appCount   = jobApps?.length || 0;
        const scoredApps = (jobApps || []).filter(a => a.match_score != null);
        const avgScore   = scoredApps.length
          ? Math.round(scoredApps.reduce((s, a) => s + a.match_score, 0) / scoredApps.length)
          : null;
        const ctr = job.views > 0 ? +((appCount / job.views) * 100).toFixed(1) : null;

        return { ...job, applicationCount: appCount, avgMatchScore: avgScore, ctr };
      })
    );

    res.json({
      kpis: { totalViews, avgTimeToHire, offerRate, avgMatchScore },
      weeklyTrend,
      funnel,
      scoreDistribution,
      jobPerformance,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

export const getCandidateAnalytics = async (req, res) => {
  try {
    const candidateId = req.user.id;

    const { count: totalApplications } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('candidate_id', candidateId);

    const { data: appsByStatus } = await supabase
      .from('applications')
      .select('status')
      .eq('candidate_id', candidateId);

    const statusCounts = (appsByStatus || []).reduce((acc, { status }) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const { data: profile } = await supabase
      .from('candidate_profiles')
      .select('skills, experience_years, headline, resume_url, profile_picture, linkedin_url, bio, desired_job_title, github_url, portfolio_url, lives_in, date_of_birth, experience, education, desired_salary')
      .eq('user_id', candidateId)
      .single();

    // ── Profile strength calculation ──────────────────────────────────────────
    // Each item has a weight — total possible = 100
    const strengthItems = [
      { label: 'Profile Photo',     done: !!profile?.profile_picture,                                       pts: 10 },
      { label: 'Headline',          done: !!profile?.headline,                                              pts: 10 },
      { label: 'Bio / Summary',     done: !!profile?.bio && profile.bio.length > 30,                       pts: 10 },
      { label: 'Skills (3+)',       done: (profile?.skills?.length ?? 0) >= 3,                             pts: 10 },
      { label: 'Resume uploaded',   done: !!profile?.resume_url,                                           pts: 15 },
      { label: 'Work experience',   done: Array.isArray(profile?.experience) ? profile.experience.length > 0 : !!profile?.experience, pts: 10 },
      { label: 'Education',         done: Array.isArray(profile?.education)  ? profile.education.length  > 0 : !!profile?.education,  pts: 5  },
      { label: 'Desired job title', done: !!profile?.desired_job_title,                                    pts: 5  },
      { label: 'Expected salary',   done: !!profile?.desired_salary,                                       pts: 5  },
      { label: 'Experience years',  done: !!profile?.experience_years,                                     pts: 5  },
      { label: 'Lives in',          done: !!profile?.lives_in,                                             pts: 3  },
      { label: 'Date of birth',     done: !!profile?.date_of_birth,                                        pts: 2  },
      { label: 'LinkedIn',          done: !!profile?.linkedin_url,                                         pts: 5  },
      { label: 'GitHub',            done: !!profile?.github_url,                                           pts: 3  },
      { label: 'Portfolio',         done: !!profile?.portfolio_url,                                        pts: 2  },
    ];

    let profileStrength = 0;
    for (const item of strengthItems) {
      if (item.done) profileStrength += item.pts;
    }
    profileStrength = Math.min(100, profileStrength);

  const { count: savedJobsCount } = await supabase
  .from('saved_jobs')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', candidateId);

const { count: activeJobsCount } = await supabase
  .from('jobs')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'active');

res.json({
  summary: { totalApplications, savedJobsCount, profileStrength, strengthItems, activeJobsCount },
  applicationsByStatus: statusCounts,
});

  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};