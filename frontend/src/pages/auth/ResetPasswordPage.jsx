import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <p className="text-red-400">Invalid or missing reset token.</p>
          <Link to="/forgot-password" className="btn-primary inline-block">Request a new link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword({
        token,
        new_password: form.new_password,
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group mb-6">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
              <Briefcase size={18} className="text-dark-700" />
            </div>
            <span className="font-display text-2xl font-bold text-white group-hover:text-brand-400 transition-colors">
              TalentBridge
            </span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-white">Set new password</h1>
          <p className="text-slate-400 mt-2">Must be at least 8 characters</p>
        </div>

        <div className="card p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">Password reset!</h2>
              <p className="text-slate-400 text-sm">Redirecting you to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} required
                    value={form.new_password} minLength={8}
                    onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                    placeholder="Min. 8 characters" className="input pr-12"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input
                  type={showPass ? 'text' : 'password'} required
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  placeholder="Re-enter password" className="input"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
