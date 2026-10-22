import { useEffect, useMemo, useState } from 'react';

const API = 'http://localhost:4000/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [status, setStatus] = useState('');
  const [dashboard, setDashboard] = useState({
    campaigns: [],
    methods: [],
    donations: [],
    applications: [],
  });

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    university: '',
    bio: '',
    photo: '',
  });

  const [campaignForm, setCampaignForm] = useState({
    title: '',
    category: 'Technology',
    goal: '',
    story: '',
    image: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    label: 'Primary card',
    type: 'visa',
    last4: '4242',
    holder: '',
  });

  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [donationAmount, setDonationAmount] = useState(100);

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API}/dashboard`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || 'Unable to load dashboard.');
        return;
      }

      setDashboard(data);
      if (data.campaigns?.length) {
        setSelectedCampaignId(data.campaigns[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch(`${API}/session`, { credentials: 'include' });
      const data = await res.json();

      if (data.user) {
        setUser(data.user);
        await loadDashboard();
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleAuth = async (event) => {
    event.preventDefault();
    setStatus('');

    const endpoint = authMode === 'login' ? '/login' : '/register';
    const payload = authMode === 'login' ? { email: form.email, password: form.password } : form;

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || 'Authentication failed.');
        return;
      }

      setUser(data.user);
      setForm({ ...form, password: '' });
      await loadDashboard();
    } catch (error) {
      setStatus('Unable to connect to the API.');
    }
  };

  const handleLogout = async () => {
    await fetch(`${API}/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    setUser(null);
    setDashboard({ campaigns: [], methods: [], donations: [], applications: [] });
  };

  const handleCampaignSubmit = async (event) => {
    event.preventDefault();
    setStatus('');

    try {
      const res = await fetch(`${API}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(campaignForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || 'Unable to publish campaign.');
        return;
      }

      setStatus('Campaign published successfully.');
      setCampaignForm({
        title: '',
        category: 'Technology',
        goal: '',
        story: '',
        image: '',
      });
      await loadDashboard();
    } catch (error) {
      setStatus('Unable to submit campaign.');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCampaignForm((prev) => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handlePaymentMethodSubmit = async (event) => {
    event.preventDefault();
    setStatus('');

    try {
      const res = await fetch(`${API}/payment-methods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(paymentForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || 'Payment method could not be saved.');
        return;
      }

      setStatus('Payment method saved.');
      setPaymentForm({
        label: 'Primary card',
        type: 'visa',
        last4: '4242',
        holder: '',
      });
      await loadDashboard();
    } catch (error) {
      setStatus('Unable to save payment method.');
    }
  };

  const handleDonation = async () => {
    if (!selectedCampaignId) return;

    try {
      const res = await fetch(`${API}/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          amount: donationAmount,
          method: 'Visa •••• 4242',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || 'Donation failed.');
        return;
      }

      setStatus('Donation completed successfully.');
      await loadDashboard();
    } catch (error) {
      setStatus('Unable to complete donation.');
    }
  };

  const handleApply = async (campaignId) => {
    try {
      const res = await fetch(`${API}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          campaignId,
          message: 'I would like to support this student’s journey.',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || 'Application could not be submitted.');
        return;
      }

      setStatus('Application submitted.');
      await loadDashboard();
    } catch (error) {
      setStatus('Unable to submit application.');
    }
  };

  const totalRaised = useMemo(
    () => (dashboard.campaigns || []).reduce((sum, item) => sum + Number(item.raised || 0), 0),
    [dashboard.campaigns]
  );

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand">
            <div className="brand-mark">S</div>
            <div>
              <h1>ScholarFund</h1>
              <p>Education, within reach</p>
            </div>
          </div>

          <div className="auth-toggle">
            <button
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
              type="button"
            >
              Sign in
            </button>
            <button
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
              type="button"
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            {authMode === 'register' && (
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            )}

            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email address"
            />

            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Password"
            />

            {authMode === 'register' && (
              <>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="student">Student</option>
                  <option value="sponsor">Sponsor</option>
                </select>

                <input
                  value={form.university}
                  onChange={(e) => setForm({ ...form, university: e.target.value })}
                  placeholder="University or school"
                />

                <textarea
                  rows={4}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Tell us about yourself"
                />

                <label className="upload-box">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setForm((prev) => ({ ...prev, photo: reader.result }));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  <span>{form.photo ? 'Profile photo selected' : 'Upload profile photo'}</span>
                </label>

                {form.photo && (
                  <img src={form.photo} alt="Profile preview" className="preview-image" />
                )}
              </>
            )}

            {status && <p className="status">{status}</p>}

            <button className="primary-btn" type="submit">
              {authMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <h2>ScholarFund</h2>
          </div>
        </div>

        <div className="topbar-role">
          {user.role === 'student'
            ? 'Student portal'
            : user.role === 'sponsor'
              ? 'Sponsor portal'
              : 'Admin portal'}
        </div>

        <button className="ghost-btn" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <main className="dashboard">
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Your impact</p>
            <h1>Support brighter futures with confidence.</h1>
            <p>
              {user.role === 'student'
                ? 'Create a campaign, share your story, and stay on top of your progress.'
                : 'Explore student journeys, fund opportunities, and build lasting support.'}
            </p>
          </div>

          <div className="hero-metrics">
            <div className="metric-card">
              <span>Total raised</span>
              <strong>${totalRaised.toLocaleString()}</strong>
            </div>
            <div className="metric-card">
              <span>Campaigns</span>
              <strong>{dashboard.campaigns.length}</strong>
            </div>
          </div>
        </section>

        {user.role === 'student' && (
          <section className="two-col">
            <div className="panel">
              <h3>Create a campaign</h3>
              <form onSubmit={handleCampaignSubmit} className="stack-form">
                <input
                  value={campaignForm.title}
                  onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                  placeholder="Campaign title"
                />

                <div className="split">
                  <select
                    value={campaignForm.category}
                    onChange={(e) => setCampaignForm({ ...campaignForm, category: e.target.value })}
                  >
                    <option>Technology</option>
                    <option>Engineering</option>
                    <option>Business</option>
                    <option>Health</option>
                    <option>Arts</option>
                  </select>

                  <input
                    type="number"
                    value={campaignForm.goal}
                    onChange={(e) => setCampaignForm({ ...campaignForm, goal: e.target.value })}
                    placeholder="Goal amount"
                  />
                </div>

                <textarea
                  rows={6}
                  value={campaignForm.story}
                  onChange={(e) => setCampaignForm({ ...campaignForm, story: e.target.value })}
                  placeholder="Share your story and explain how this support matters"
                />

                <label className="upload-box">
                  <input type="file" accept="image/*" onChange={handleFileUpload} />
                  <span>{campaignForm.image ? 'Photo selected' : 'Upload campaign image'}</span>
                </label>

                {campaignForm.image && (
                  <img src={campaignForm.image} alt="Campaign preview" className="preview-image" />
                )}

                <button className="primary-btn" type="submit">
                  Publish campaign
                </button>
              </form>
            </div>

            <div className="panel">
              <h3>My campaigns</h3>

              <div className="list">
                {(dashboard.campaigns || []).map((campaign) => (
                  <div key={campaign.id} className="campaign-card">
                    {campaign.image && <img src={campaign.image} alt={campaign.title} />}

                    <div>
                      <h4>{campaign.title}</h4>
                      <p>{campaign.category}</p>
                      <div className="progress">
                        <div
                          style={{
                            width: `${Math.min((Number(campaign.raised) / Number(campaign.goal)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <small>
                        ${Number(campaign.raised || 0).toLocaleString()} raised of ${
                          Number(campaign.goal).toLocaleString()
                        }
                      </small>
                    </div>
                  </div>
                ))}

                {!dashboard.campaigns?.length && <p>No campaigns yet.</p>}
              </div>
            </div>
          </section>
        )}

        {user.role === 'sponsor' && (
          <section className="two-col">
            <div className="panel">
              <h3>Saved payment methods</h3>

              <form onSubmit={handlePaymentMethodSubmit} className="stack-form">
                <input
                  value={paymentForm.label}
                  onChange={(e) => setPaymentForm({ ...paymentForm, label: e.target.value })}
                  placeholder="Method label"
                />

                <select
                  value={paymentForm.type}
                  onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value })}
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="bank">Bank transfer</option>
                </select>

                <input
                  value={paymentForm.last4}
                  onChange={(e) => setPaymentForm({ ...paymentForm, last4: e.target.value })}
                  placeholder="Last 4 digits"
                />

                <input
                  value={paymentForm.holder}
                  onChange={(e) => setPaymentForm({ ...paymentForm, holder: e.target.value })}
                  placeholder="Cardholder name"
                />

                <button type="submit" className="primary-btn">
                  Save method
                </button>
              </form>

              <div className="chip-list">
                {(dashboard.methods || []).map((method) => (
                  <div key={method.id} className="chip">
                    <span>{method.label}</span>
                    <small>
                      {method.type.toUpperCase()} •••• {method.last4 || '0000'}
                    </small>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>Support a campaign</h3>

              <select
                value={selectedCampaignId || ''}
                onChange={(e) => setSelectedCampaignId(Number(e.target.value))}
              >
                {(dashboard.campaigns || []).map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </select>

              <div className="donation-bar">
                <input
                  type="number"
                  min="10"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(Number(e.target.value))}
                />
                <button className="primary-btn" onClick={handleDonation}>
                  Donate
                </button>
              </div>

              <div className="list">
                {(dashboard.campaigns || []).map((campaign) => (
                  <div key={campaign.id} className="campaign-card">
                    {campaign.image && <img src={campaign.image} alt={campaign.title} />}

                    <div>
                      <h4>{campaign.title}</h4>
                      <p>{campaign.story}</p>

                      <div className="progress">
                        <div
                          style={{
                            width: `${Math.min((Number(campaign.raised) / Number(campaign.goal)) * 100, 100)}%`,
                          }}
                        />
                      </div>

                      <small>
                        ${Number(campaign.raised || 0).toLocaleString()} raised of ${
                          Number(campaign.goal).toLocaleString()
                        }
                      </small>
                    </div>

                    <button className="ghost-btn" onClick={() => handleApply(campaign.id)}>
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {status && <p className="status">{status}</p>}
      </main>
    </div>
  );
}
