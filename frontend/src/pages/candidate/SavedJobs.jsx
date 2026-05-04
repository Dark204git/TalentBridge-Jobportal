import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import JobCard from '../../components/common/JobCard';
import { profilesAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function SavedJobs() {
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profilesAPI.getSavedJobs()
      .then(({ data }) => {
        setSavedJobs(data);
        setSavedIds(new Set(data.map((s) => s.job_id)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUnsave = async (jobId) => {
    try {
      await profilesAPI.saveJob({ job_id: jobId });
      setSavedJobs((prev) => prev.filter((s) => s.job_id !== jobId));
      setSavedIds((prev) => { const n = new Set(prev); n.delete(jobId); return n; });
      toast.success('Job removed from saved');
    } catch {
      toast.error('Failed to remove job');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Saved Jobs</h1>
          <p className="text-slate-400 mt-1">{savedJobs.length} saved job{savedJobs.length !== 1 ? 's' : ''}</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-32" />)}
          </div>
        ) : savedJobs.length === 0 ? (
          <div className="card text-center py-16">
            <Bookmark size={48} className="text-slate-600 mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-white mb-2">No saved jobs</h3>
            <p className="text-slate-400 mb-6">Bookmark jobs you're interested in while browsing</p>
            <Link to="/jobs" className="btn-primary inline-block">Browse Jobs</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {savedJobs.map((saved) => saved.jobs && (
              <JobCard
                key={saved.id}
                job={saved.jobs}
                saved={savedIds.has(saved.job_id)}
                onSave={handleUnsave}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
