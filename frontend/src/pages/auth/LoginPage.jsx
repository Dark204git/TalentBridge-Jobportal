import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
try {
  const user = await login(form.email, form.password);
  toast.success('Welcome back!');
  navigate(user.role === 'employer' ? '/employer' : '/candidate');
} catch (err) {
  const msg = err.response?.data?.error || 'Login failed';
  setError(msg === 'Invalid credentials'
    ? 'Invalid email or password. Please try again.'
    : msg
    
  );
} finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
    <span>⚠</span>
    {error}
  </div>
)}
        <div>
          <label className="label">Email</label>
          <input
            type="email" required value={form.email}
           onChange={(e) =>  setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com" className="input"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'} required value={form.password}
              onChange={(e) =>  setForm({ ...form, password: e.target.value })}
              placeholder="••••••••" className="input pr-12"
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-400 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">Create one →</Link>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    role: searchParams.get('role') || 'candidate'
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const user = await register(form);
      toast.success('Account created!');
      navigate(user.role === 'employer' ? '/employer' : '/candidate');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Join thousands of professionals">
      //Role Selector 
      <div className="grid grid-cols-2 gap-3 mb-6">
        {['candidate', 'employer'].map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setForm({ ...form, role })}
            className={`py-3 px-4 rounded-xl border text-sm font-medium capitalize transition-all ${
              form.role === role
                ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                : 'border-dark-400 text-slate-400 hover:border-dark-300'
            }`}
          >
            {role === 'candidate' ? '👤 Job Seeker' : '🏢 Employer'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Full Name</label>
          <input type="text" required value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="John Doe" className="input" />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com" className="input" />
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 8 characters" className="input pr-12" minLength={8} />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? 'Creating Account...' : `Create ${form.role === 'employer' ? 'Employer' : 'Candidate'} Account`}
        </button>
      </form>
      <p className="text-center text-sm text-slate-400 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in →</Link>
      </p>
    </AuthLayout>
  );
}

function AuthLayout({ title, subtitle, children }) {
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
          <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
          <p className="text-slate-400 mt-2">{subtitle}</p>
        </div>
        <div className="card p-8">{children}</div>
      </div>
    </div>
  );
}

export default LoginPage;
