import { useMemo, useState } from 'react';
import {
  Building2, MapPin, User, Home, Ruler, Receipt, RefreshCw,
  CheckCircle2, AlertCircle, Calendar, IndianRupee, LogOut, Menu, X,
  Search, KeyRound, CreditCard, FileSearch, ArrowLeft, Bell, Phone, Mail,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import TaxBreakdown from '../components/TaxBreakdown';

// Public API base (same convention as the RTK slices).
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/';

// ── Branding placeholders ──────────────────────────────────────
// Swap the emblem and titles for your ULB's official assets before going live.
const TITLE_HI = 'नगर निगम';
const TITLE_EN = 'Municipal Corporation';

// Nav item → internal view key.
const NAV = [
  { key: 'home', label: 'Home' },
  { key: 'know-tax', label: 'Know Your House Tax' },
  { key: 'login', label: 'Login' },
  { key: 'pay', label: 'Pay Your House Tax' },
  { key: 'know-id', label: 'Know Your New House ID' },
  { key: 'forgot', label: 'Forgot Password' },
];

// ── STATIC DEMO DATA ───────────────────────────────────────────
// The same illustrative record is returned for any House ID / mobile — no
// backend lookup or real tax calculation is wired up yet.
const demoRecord = (houseId) => ({
  house_id: houseId || '9157012345',
  owner_name: 'Ram Prasad Verma',
  father_name: 'Late Shri Mohan Lal Verma',
  mobile: '98XXXXXX10',
  address: '8/642, Gangraha Purwa, Lucknow, Uttar Pradesh, 226022',
  ward: 'Ward 12 — Vikas Nagar',
  zone: 'Zone 2',
  ulb: 'Lucknow Municipal Corporation',
  property_type: 'Residential — Single Storey',
  usage: 'Self Occupied',
  plot_area_sqm: 151,
  builtup_area_sqm: 120,
  assessment_year: '2025–26',
  arv: 48000,
  heads: [
    { label: 'House Tax', amount: 3600 },
    { label: 'Water Tax', amount: 960 },
    { label: 'Sewerage Tax', amount: 720 },
    { label: 'Conservancy / Sanitation', amount: 480 },
    { label: 'Education Cess', amount: 240 },
  ],
  arrears: 1150,
  rebate: 300,
  paid: 0,
  history: [
    { year: '2024–25', demand: 5760, paid: 5760, status: 'Paid', date: '14 Jun 2024' },
    { year: '2023–24', demand: 5400, paid: 5400, status: 'Paid', date: '02 Jul 2023' },
    { year: '2022–23', demand: 5100, paid: 3950, status: 'Part Paid', date: '19 Aug 2022' },
  ],
});

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const randomCaptcha = () =>
  Array.from({ length: 6 }, () =>
    'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 54)]
  ).join('');

const inputCls =
  'w-full border-b border-gray-300 dark:border-gray-600 bg-transparent px-2 py-3 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 outline-none';
const boxCls =
  'border border-gray-200 dark:border-gray-700 rounded-lg p-5 bg-gray-50 dark:bg-gray-900/40';

// ── Small building blocks ──────────────────────────────────────
function EmblemPlaceholder() {
  // Generic shield — replace with the official municipal emblem.
  return (
    <svg viewBox="0 0 48 56" className="w-11 h-12" aria-hidden="true">
      <path d="M24 2 L44 10 V30 C44 44 34 52 24 54 C14 52 4 44 4 30 V10 Z"
        fill="#2563eb" stroke="#93c5fd" strokeWidth="2" />
      <path d="M24 8 L38 14 V30 C38 40 31 46 24 48 C17 46 10 40 10 30 V14 Z" fill="#fff" />
      <path d="M24 14 L33 18 V30 C33 37 28 41 24 43 C20 41 15 37 15 30 V18 Z" fill="#2563eb" />
    </svg>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 break-words">{value}</p>
      </div>
    </div>
  );
}

function CardHeader({ icon: Icon, title }) {
  return (
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      <h3 className="font-bold text-gray-900 dark:text-gray-100">{title}</h3>
    </div>
  );
}

function Panel({ title, children, className = '' }) {
  return (
    <div className={`max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}>
      <div className="bg-blue-600 px-6 py-4">
        <h2 className="text-white text-xl font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── Tax details (shared by Login / Know / Pay) ─────────────────
function TaxDetails({ record, onExit, exitLabel = 'Back', exitIcon: ExitIcon = ArrowLeft }) {
  const currentDemand = useMemo(
    () => record.heads.reduce((s, h) => s + h.amount, 0) + record.arrears - record.rebate,
    [record]
  );
  const balanceDue = currentDemand - record.paid;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-blue-600 dark:text-blue-400">
          House Tax — Assessment {record.assessment_year}
        </h2>
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          <ExitIcon className="w-4 h-4" /> {exitLabel}
        </button>
      </div>

      <div className={`rounded-xl p-6 text-white ${balanceDue > 0 ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-green-600'}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm opacity-90">Total Balance Due</p>
            <p className="text-3xl font-extrabold mt-1">{inr(balanceDue)}</p>
            <p className="text-xs opacity-90 mt-1">House ID: {record.house_id}</p>
          </div>
          {balanceDue > 0 ? (
            <button className="bg-white/95 text-red-600 font-bold px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-white transition">
              <IndianRupee className="w-5 h-5" /> Pay Now
            </button>
          ) : (
            <span className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg font-semibold">
              <CheckCircle2 className="w-5 h-5" /> No dues
            </span>
          )}
        </div>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <CardHeader icon={Home} title="Property Details" />
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Field icon={User} label="Owner" value={record.owner_name} />
          <Field icon={User} label="Father / Husband" value={record.father_name} />
          <Field icon={Home} label="Property Type" value={record.property_type} />
          <Field icon={MapPin} label="Address" value={record.address} />
          <Field icon={MapPin} label="Ward / Zone" value={`${record.ward} · ${record.zone}`} />
          <Field icon={Building2} label="ULB" value={record.ulb} />
          <Field icon={Ruler} label="Plot Area" value={`${record.plot_area_sqm} sq.m`} />
          <Field icon={Ruler} label="Built-up Area" value={`${record.builtup_area_sqm} sq.m`} />
          <Field icon={Receipt} label="Annual Rateable Value" value={inr(record.arv)} />
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <CardHeader icon={Receipt} title={`Current Demand — ${record.assessment_year}`} />
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {record.heads.map((h) => (
            <div key={h.label} className="px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">{h.label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{inr(h.amount)}</span>
            </div>
          ))}
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Arrears (previous years)</span>
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{inr(record.arrears)}</span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Rebate (early payment)</span>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">− {inr(record.rebate)}</span>
          </div>
          <div className="px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
            <span className="font-bold text-gray-900 dark:text-gray-100">Total Payable</span>
            <span className="text-lg font-extrabold text-blue-700 dark:text-blue-400">{inr(currentDemand)}</span>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <CardHeader icon={Calendar} title="Payment History" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-6 py-2 font-medium">Year</th>
                <th className="text-right px-3 py-2 font-medium">Demand</th>
                <th className="text-right px-3 py-2 font-medium">Paid</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-6 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {record.history.map((r) => (
                <tr key={r.year}>
                  <td className="px-6 py-3 text-gray-800 dark:text-gray-200">{r.year}</td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{inr(r.demand)}</td>
                  <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{inr(r.paid)}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.status === 'Paid'
                        ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// The real approved tax for a property, with the full derivation.
function RealTaxView({ assessment, onExit, pay }) {
  const b = assessment.breakdown || {};
  const total = assessment.total_amount ?? b.total_annual;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-blue-600 dark:text-blue-400">
          House Tax — Assessment {b.assessment_year || assessment.assessment_year}
        </h2>
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          <Search className="w-4 h-4" /> New Search
        </button>
      </div>

      {pay && (
        <div className="rounded-xl p-6 text-white bg-gradient-to-r from-red-500 to-rose-600">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm opacity-90">Total Payable</p>
              <p className="text-3xl font-extrabold mt-1">₹{Number(total || 0).toLocaleString('en-IN')}</p>
              {b.property?.property_code && <p className="text-xs opacity-90 mt-1">House ID: {b.property.property_code}</p>}
            </div>
            <button className="bg-white/95 text-red-600 font-bold px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-white transition">
              <IndianRupee className="w-5 h-5" /> Pay Now
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <TaxBreakdown breakdown={b} />
      </div>
    </div>
  );
}

// ── House-ID lookup → real approved assessment (Know / Pay) ─────
function LookupView({ title, subtitle, cta, icon, pay }) {
  const [houseId, setHouseId] = useState('');
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (assessment) {
    return <RealTaxView assessment={assessment} onExit={() => setAssessment(null)} pay={pay} />;
  }

  const go = async (e) => {
    e.preventDefault();
    const code = houseId.trim();
    if (!code) return setError('Enter your House ID.');
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}tax/public/code/${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok || !json.success) setError(json.message || 'No tax found for this House ID.');
      else setAssessment(json.data);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel title={title}>
      <form onSubmit={go} className="p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{subtitle}</p>
        <div className={boxCls}>
          <input value={houseId} onChange={(e) => setHouseId(e.target.value)}
            placeholder="House Id e.g. 12/345/1" className={inputCls} />
        </div>
        {error && <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 mt-4"><AlertCircle className="w-4 h-4" /> {error}</p>}
        <button type="submit" disabled={loading}
          className="mt-5 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900 text-white font-semibold px-8 py-2.5 rounded-lg transition">
          {icon} {loading ? 'Searching…' : cta}
        </button>
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-4">
          Enter your House ID (property code). Only assessments approved by the municipal office are shown here.
        </p>
      </form>
    </Panel>
  );
}

// ── Login ──────────────────────────────────────────────────────
function LoginView() {
  const [houseId, setHouseId] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [captcha, setCaptcha] = useState(randomCaptcha);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);

  const refreshCaptcha = () => { setCaptcha(randomCaptcha()); setPin(''); };

  const submit = (e) => {
    e.preventDefault();
    // Password is the registered mobile number; the identifier can be a House
    // ID or that same mobile number.
    if (!houseId.trim()) return setError('Enter your House ID or registered mobile number.');
    if (!password.trim()) return setError('Enter your password (registered mobile number).');
    if (pin.trim().toLowerCase() !== captcha.toLowerCase()) {
      setError('Security pin does not match the image.');
      refreshCaptcha();
      return;
    }
    setError('');
    setRecord(demoRecord(houseId.trim()));
  };

  const logout = () => {
    setRecord(null);
    setHouseId(''); setPassword(''); setPin('');
    refreshCaptcha();
  };

  if (record) {
    return <TaxDetails record={record} onExit={logout} exitLabel="Logout" exitIcon={LogOut} />;
  }
  return (
    <Panel title="Login to pay House Tax / User Charges">
      <form onSubmit={submit} className="p-6">
        <div className={`${boxCls} space-y-1`}>
          <input value={houseId} onChange={(e) => setHouseId(e.target.value)}
            placeholder="House Id e.g. 9157XXXXXX  — or Mobile Number" className={inputCls} />
          <div className="text-right">
            <button type="button" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Know your House Id ?</button>
          </div>

          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (your registered mobile number)" className={inputCls} />
          <div className="text-right">
            <button type="button" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Forgot Password ?</button>
          </div>

          <input value={pin} onChange={(e) => setPin(e.target.value)}
            placeholder="Enter Security Pin Shown In Image" className={inputCls} />

          <div className="flex items-center gap-3 pt-3">
            <span className="select-none px-4 py-2 rounded font-mono text-lg tracking-[0.3em] text-white italic"
              style={{ background: 'repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a 6px,#1d4ed8 6px,#1d4ed8 12px)', textDecoration: 'line-through' }}>
              {captcha}
            </span>
            <button type="button" onClick={refreshCaptcha} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200" title="Refresh">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 mt-4"><AlertCircle className="w-4 h-4" /> {error}</p>}

        <button type="submit" className="mt-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 rounded-lg transition">
          Submit
        </button>
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-4">
          Demo portal — password is the registered mobile number. Any House ID/mobile returns sample data.
        </p>
      </form>
    </Panel>
  );
}

// ── Know Your New House ID ─────────────────────────────────────
function KnowIdView() {
  const [form, setForm] = useState({ old_id: '', owner: '', mobile: '', ward: '' });
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const search = (e) => {
    e.preventDefault();
    setResult({ house_id: '9157012345', owner: form.owner || 'Ram Prasad Verma', ward: form.ward || 'Ward 12 — Vikas Nagar' });
  };
  return (
    <Panel title="Know Your New House ID">
      <form onSubmit={search} className="p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Search using any detail you remember — old House ID, owner name, registered mobile, or ward.
        </p>
        <div className={`${boxCls} grid sm:grid-cols-2 gap-4`}>
          <input value={form.old_id} onChange={set('old_id')} placeholder="Old House ID" className={inputCls} />
          <input value={form.owner} onChange={set('owner')} placeholder="Owner Name" className={inputCls} />
          <input value={form.mobile} onChange={set('mobile')} placeholder="Registered Mobile" className={inputCls} />
          <input value={form.ward} onChange={set('ward')} placeholder="Ward" className={inputCls} />
        </div>
        <button type="submit" className="mt-5 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 rounded-lg transition">
          <FileSearch className="w-4 h-4" /> Search
        </button>

        {result && (
          <div className="mt-6 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-5">
            <p className="text-sm text-gray-600 dark:text-gray-400">Match found for <span className="font-medium text-gray-800 dark:text-gray-200">{result.owner}</span> · {result.ward}</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Your New House ID</p>
            <p className="text-2xl font-extrabold text-green-700 dark:text-green-400 tracking-wide">{result.house_id}</p>
          </div>
        )}
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-4">Demo portal — returns a sample House ID.</p>
      </form>
    </Panel>
  );
}

// ── Forgot Password ────────────────────────────────────────────
function ForgotView() {
  const [ident, setIdent] = useState('');
  const [sent, setSent] = useState(false);
  const send = (e) => { e.preventDefault(); if (ident.trim()) setSent(true); };
  return (
    <Panel title="Forgot Password">
      <form onSubmit={send} className="p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Enter your House ID or registered mobile number. An OTP will be sent to the registered mobile to reset your password.
        </p>
        <div className={boxCls}>
          <input value={ident} onChange={(e) => setIdent(e.target.value)}
            placeholder="House Id or Registered Mobile Number" className={inputCls} />
        </div>
        <button type="submit" className="mt-5 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2.5 rounded-lg transition">
          <KeyRound className="w-4 h-4" /> Send OTP
        </button>

        {sent && (
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4">
            <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              An OTP has been sent to your registered mobile number <span className="font-medium">98XXXXXX10</span>. Enter it to set a new password.
            </p>
          </div>
        )}
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-4">Demo portal — no OTP is actually sent.</p>
      </form>
    </Panel>
  );
}

// ── Home ───────────────────────────────────────────────────────
function HomeView({ onNavigate }) {
  const actions = [
    { key: 'pay', icon: CreditCard, title: 'Pay Your House Tax', desc: 'Pay dues online by House ID or mobile.' },
    { key: 'know-tax', icon: Search, title: 'Know Your House Tax', desc: 'View your current demand & assessment.' },
    { key: 'know-id', icon: FileSearch, title: 'Know Your New House ID', desc: 'Find your new House ID from old details.' },
    { key: 'login', icon: User, title: 'Login', desc: 'Sign in with House ID / mobile to manage dues.' },
  ];
  const notices = [
    { date: '20 Jul 2026', text: '5% rebate on full-year House Tax if paid before 31 August 2026.' },
    { date: '05 Jul 2026', text: 'Assessment year 2025–26 demand notices are now available online.' },
    { date: '28 Jun 2026', text: 'House Mutation applications can be tracked at your zonal office.' },
  ];
  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold">Welcome to the Citizen Tax Portal</h2>
        <p className="mt-2 text-sm sm:text-base text-blue-100 max-w-2xl">
          Check your house tax, pay dues online, and manage your property assessment — all in one place.
        </p>
        <button onClick={() => onNavigate('pay')}
          className="mt-5 inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-50 transition">
          <IndianRupee className="w-4 h-4" /> Pay House Tax
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {actions.map((a) => (
          <button key={a.key} onClick={() => onNavigate(a.key)}
            className="text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 transition group">
            <a.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h3 className="mt-3 font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">{a.title}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{a.desc}</p>
          </button>
        ))}
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <CardHeader icon={Bell} title="Notices & Announcements" />
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {notices.map((n) => (
            <li key={n.date} className="px-6 py-4 flex gap-4">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap mt-0.5">{n.date}</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{n.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 grid sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Helpline</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">1800-XXX-XXXX (Toll Free)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Email</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">housetax@ulb.gov.in</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Page shell ─────────────────────────────────────────────────
export default function PropertyTaxPage() {
  const [view, setView] = useState('home');
  const [navOpen, setNavOpen] = useState(false);

  const navigate = (key) => { setView(key); setNavOpen(false); };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Emblem / title band */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate('home')} className="flex-shrink-0" title="Home">
            <EmblemPlaceholder />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 leading-tight">{TITLE_HI}</h1>
            <p className="text-lg sm:text-xl font-semibold text-blue-600 dark:text-blue-400">{TITLE_EN}</p>
          </div>
          <ThemeToggle className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" />
        </div>
      </div>

      {/* Navigation bar */}
      <nav className="bg-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between sm:hidden py-3">
            <span className="font-semibold text-sm">Menu</span>
            <button onClick={() => setNavOpen((o) => !o)} aria-label="Toggle menu">
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
          <ul className={`${navOpen ? 'block' : 'hidden'} sm:flex sm:flex-wrap pb-2 sm:pb-0`}>
            {NAV.map((item) => (
              <li key={item.key}>
                <button onClick={() => navigate(item.key)}
                  className={`block w-full text-left sm:w-auto px-4 py-3 text-sm font-semibold uppercase tracking-wide transition ${
                    view === item.key ? 'bg-blue-800' : 'hover:bg-blue-800'
                  }`}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === 'home' && <HomeView onNavigate={navigate} />}
        {view === 'know-tax' && (
          <LookupView title="Know Your House Tax"
            subtitle="Enter your House ID to view your current demand and assessment details."
            cta="View Tax" icon={<Search className="w-4 h-4" />} />
        )}
        {view === 'login' && <LoginView />}
        {view === 'pay' && (
          <LookupView title="Pay Your House Tax"
            subtitle="Enter your House ID to view dues and proceed to payment."
            cta="Proceed to Pay" icon={<CreditCard className="w-4 h-4" />} pay />
        )}
        {view === 'know-id' && <KnowIdView />}
        {view === 'forgot' && <ForgotView />}
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            For assistance, contact your Urban Local Body tax office. This is a demonstration portal.
          </p>
        </div>
      </footer>
    </div>
  );
}
