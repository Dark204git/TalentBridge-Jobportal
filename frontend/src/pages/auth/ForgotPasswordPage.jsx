import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ArrowLeft, Mail } from 'lucide-react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong');
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
          <h1 className="font-display text-3xl font-bold text-white">Forgot password?</h1>
          <p className="text-slate-400 mt-2">We'll send a reset link to your email</p>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto">
                <Mail size={28} className="text-brand-400" />
              </div>
              <h2 className="text-white font-semibold text-lg">Check your inbox</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                If <span className="text-white">{email}</span> is registered, you'll receive a
                password reset link within a few minutes.
              </p>
              <p className="text-slate-500 text-xs">Didn't receive it? Check your spam folder.</p>
              <Link to="/login" className="btn-primary w-full mt-4 inline-block text-center">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className="input"
                    autoFocus
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <Link to="/login"
                className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 mt-6 transition-colors">
                <ArrowLeft size={15} /> Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
