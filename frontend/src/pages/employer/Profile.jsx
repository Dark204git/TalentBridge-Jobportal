import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Globe, Linkedin, Twitter, Save, Loader, User } from 'lucide-react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { profilesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Media', 'Consulting', 'Real Estate', 'Other'];
const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

export default function EmployerProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    company_name: '', company_description: '', industry: '',
    company_size: '', company_website: '', company_logo: '',
    headquarters: '', founded_year: '', linkedin_url: '', twitter_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    profilesAPI.getEmployer()
      .then(({ data }) => {
        if (data) setForm({
          company_name: data.company_name || '',
          company_description: data.company_description || '',
          industry: data.industry || '',
          company_size: data.company_size || '',
          company_website: data.company_website || '',
          company_logo: data.company_logo || '',
          headquarters: data.headquarters || '',
          founded_year: data.founded_year || '',
          linkedin_url: data.linkedin_url || '',
          twitter_url: data.twitter_url || '',
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      await profilesAPI.updateEmployer(form);
      toast.success('Company profile updated!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-24" />)}
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white">Company Profile</h1>
          <p className="text-slate-400 mt-1">A complete profile attracts better candidates</p>
        </div>

        {/* ── Account Info ── */}
        <div className="card mb-6 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brand-500/15 flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-brand-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{user?.name || user?.full_name || 'No name set'}</p>
            <p className="text-sm text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card space-y-5">
            <h2 className="font-semibold text-white border-b border-dark-400 pb-3">Company Identity</h2>

            {/* Logo Preview */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-dark-500 border border-dark-300 rounded-2xl flex items-center justify-center text-2xl font-bold text-brand-400 overflow-hidden flex-shrink-0">
                {form.company_logo ? (
                  <img src={form.company_logo} alt="" className="w-full h-full object-cover" />
                ) : (
                  form.company_name?.[0]?.toUpperCase() || <Building2 size={24} />
                )}
              </div>
              <div className="flex-1">
                <label className="label">Company Logo URL</label>
                <input value={form.company_logo} onChange={(e) => set('company_logo', e.target.value)}
                  placeholder="https://yourcompany.com/logo.png" className="input text-sm" />
              </div>
            </div>

            <div>
              <label className="label">Company Name *</label>
              <input value={form.company_name} onChange={(e) => set('company_name', e.target.value)}
                placeholder="Acme Corp" className="input" required />
            </div>
            <div>
              <label className="label">About the Company</label>
              <textarea value={form.company_description} onChange={(e) => set('company_description', e.target.value)}
                rows={4} placeholder="What does your company do? What's the culture like?"
                className="input resize-none" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Industry</label>
                <select value={form.industry} onChange={(e) => set('industry', e.target.value)} className="input">
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Company Size</label>
                <select value={form.company_size} onChange={(e) => set('company_size', e.target.value)} className="input">
                  <option value="">Select size</option>
                  {SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Headquarters</label>
                <input value={form.headquarters} onChange={(e) => set('headquarters', e.target.value)}
                  placeholder="San Francisco, CA" className="input" />
              </div>
              <div>
                <label className="label">Founded Year</label>
                <input type="number" value={form.founded_year} onChange={(e) => set('founded_year', e.target.value)}
                  placeholder="2018" className="input" min="1800" max={new Date().getFullYear()} />
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-white border-b border-dark-400 pb-3">Online Presence</h2>
            <div>
              <label className="label flex items-center gap-1"><Globe size={14} /> Website</label>
              <input value={form.company_website} onChange={(e) => set('company_website', e.target.value)}
                placeholder="https://yourcompany.com" className="input" type="url" />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Linkedin size={14} /> LinkedIn</label>
              <input value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)}
                placeholder="https://linkedin.com/company/yourcompany" className="input" />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Twitter size={14} /> Twitter/X</label>
              <input value={form.twitter_url} onChange={(e) => set('twitter_url', e.target.value)}
                placeholder="https://twitter.com/yourcompany" className="input" />
            </div>
          </div>

          <div className="flex justify-end pb-8">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* ── Settings Shortcut ── */}
        <div className="card border border-white/[0.07] space-y-3 mb-8 flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Account Settings</p>
            <p className="text-xs text-slate-400 mt-0.5">Reset password, change theme, or delete your account</p>
          </div>
          <Link
            to="/employer/settings"
            className="btn-secondary text-xs px-4 py-2 whitespace-nowrap"
          >
            Go to Settings →
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}