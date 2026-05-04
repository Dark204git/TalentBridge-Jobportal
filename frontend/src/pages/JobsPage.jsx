import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, X, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import Navbar from '../components/common/Navbar';
import JobCard from '../components/common/JobCard';
import { jobsAPI, profilesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'freelance', 'internship'];
const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior', 'lead', 'executive'];
const CATEGORIES = ['Technology', 'Finance', 'Design', 'Marketing', 'Healthcare', 'Legal', 'Education', 'Engineering', 'Sales', 'HR'];

export default function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isCandidate } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    location: searchParams.get('location') || '',
    job_type: searchParams.get('job_type') || '',
    experience_level: searchParams.get('experience_level') || '',
    category: searchParams.get('category') || '',
    is_remote: searchParams.get('is_remote') || '',
    page: parseInt(searchParams.get('page') || '1'),
  });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await jobsAPI.getJobs(params);
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    if (isCandidate) {
      profilesAPI.getSavedJobs()
        .then(({ data }) => setSavedIds(new Set(data.map((s) => s.job_id))))
        .catch(() => {});
    }
  }, [isCandidate]);

  const updateFilter = (key, value) => {
    setFilters((p) => ({ ...p, [key]: value, page: 1 }));
  };

  const handleSave = async (jobId) => {
    if (!user) { toast.error('Please log in to save jobs'); return; }
    try {
      const { data } = await profilesAPI.saveJob({ job_id: jobId });
      setSavedIds((prev) => {
        const next = new Set(prev);
        data.saved ? next.add(jobId) : next.delete(jobId);
        return next;
      });
      toast.success(data.saved ? 'Job saved!' : 'Job removed from saved');
    } catch {
      toast.error('Failed to save job');
    }
  };

  const clearFilters = () => setFilters({ search: '', location: '', job_type: '', experience_level: '', category: '', is_remote: '', page: 1 });
  const activeFilterCount = [filters.job_type, filters.experience_level, filters.category, filters.is_remote].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />

      {/* Search Header */}
      <div className="bg-dark-800 border-b border-dark-400 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-3 flex-1 bg-dark-700 border border-dark-400 rounded-xl px-4 py-3 focus-within:border-brand-500 transition-colors">
              <Search size={18} className="text-slate-500" />
              <input
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                placeholder="Search job titles, keywords..."
                className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
              />
              {filters.search && <button onClick={() => updateFilter('search', '')}><X size={14} className="text-slate-500" /></button>}
            </div>
            <div className="flex items-center gap-3 sm:w-56 bg-dark-700 border border-dark-400 rounded-xl px-4 py-3 focus-within:border-brand-500 transition-colors">
              <MapPin size={18} className="text-slate-500" />
              <input
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
                placeholder="Location..."
                className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
              />
            </div>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="relative flex items-center gap-2 btn-secondary"
            >
              <Filter size={16} /> Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-500 text-dark-700 text-xs rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filters Panel */}
          {filtersOpen && (
            <div className="mt-4 p-4 bg-dark-700 border border-dark-400 rounded-xl animate-slide-up">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="label">Job Type</label>
                  <select value={filters.job_type} onChange={(e) => updateFilter('job_type', e.target.value)} className="input text-sm capitalize">
                    <option value="">All Types</option>
                    {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Experience</label>
                  <select value={filters.experience_level} onChange={(e) => updateFilter('experience_level', e.target.value)} className="input text-sm capitalize">
                    <option value="">All Levels</option>
                    {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <select value={filters.category} onChange={(e) => updateFilter('category', e.target.value)} className="input text-sm">
                    <option value="">All Categories</option>
                    {CATEGORIES.map((c) => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Work Type</label>
                  <select value={filters.is_remote} onChange={(e) => updateFilter('is_remote', e.target.value)} className="input text-sm">
                    <option value="">All</option>
                    <option value="true">Remote Only</option>
                  </select>
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-slate-400 text-sm">
            {loading ? 'Loading...' : `${total.toLocaleString()} jobs found`}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-dark-500 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-dark-500 rounded w-48" />
                    <div className="h-3 bg-dark-500 rounded w-32" />
                    <div className="h-3 bg-dark-500 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <h3 className="font-display text-xl font-bold text-white mb-2">No jobs found</h3>
            <p className="text-slate-400">Try adjusting your search or filters</p>
            <button onClick={clearFilters} className="btn-secondary mt-6">Clear Filters</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                saved={savedIds.has(job.id)}
                onSave={isCandidate ? handleSave : null}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
              disabled={filters.page === 1}
              className="btn-secondary py-2 px-4 disabled:opacity-50 flex items-center gap-2"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-slate-400 text-sm">Page {filters.page} of {totalPages}</span>
            <button
              onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
              disabled={filters.page === totalPages}
              className="btn-secondary py-2 px-4 disabled:opacity-50 flex items-center gap-2"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
