import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Students from "./pages/Students";
import Registration from "./pages/Registration";
import DeleteRecords from "./pages/DeleteRecords";
import HouseMasterMonitoring from "./pages/HouseMasterMonitoring";
import Rooms from "./pages/Rooms";
import Payment from "./pages/Payment";
import Reports from "./pages/Reports";
import AcademicYear from "./pages/AcademicYear";
import "./App.css";
import "./UI-polish.css";

const STAFF_ACCOUNTS = {
  house_master: [
    {
      key: "hm1",
      label: "House Master 1",
      email: "housemaster1@gbewah.local",
    },
    {
      key: "hm2",
      label: "House Master 2",
      email: "housemaster2@gbewah.local",
    },
    {
      key: "hm3",
      label: "House Master 3",
      email: "housemaster3@gbewah.local",
    },
    {
      key: "hm4",
      label: "House Master 4",
      email: "housemaster4@gbewah.local",
    },
  ],
  prefect: [
    {
      key: "hp1",
      label: "House Prefect 1",
      email: "houseprefect1@gbewah.local",
    },
    {
      key: "hp2",
      label: "House Prefect 2",
      email: "houseprefect2@gbewah.local",
    },
    {
      key: "hp3",
      label: "House Prefect 3",
      email: "houseprefect3@gbewah.local",
    },
  ],
};

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    setLoading(true);

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const currentSession = data.session;

    if (!currentSession) {
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setSession(currentSession);

    const currentProfile = await getStaffProfile(currentSession.user.id);

    if (!currentProfile) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    if (!currentProfile.is_active) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(currentProfile);
    setLoading(false);
  }

  async function getStaffProfile(userId) {
    const { data, error } = await supabase
      .from("staff_profiles")
      .select(
        "staff_id, full_name, role, must_change_password, is_active"
      )
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Profile error:", error);
      return null;
    }

    return data;
  }

  async function handleLoginSuccess(userSession) {
    setLoading(true);
    setSession(userSession);

    const currentProfile = await getStaffProfile(userSession.user.id);

    if (!currentProfile) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setLoading(false);
      return false;
    }

    if (!currentProfile.is_active) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setLoading(false);
      return false;
    }

    setProfile(currentProfile);
    setLoading(false);

    return true;
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    setSession(null);
    setProfile(null);
    setLoading(false);
  }

  async function refreshProfile() {
    if (!session) return;

    const updatedProfile = await getStaffProfile(session.user.id);

    if (updatedProfile) {
      setProfile(updatedProfile);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session || !profile) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (profile.must_change_password) {
    return (
      <ChangePasswordPage
        profile={profile}
        onComplete={refreshProfile}
        onLogout={handleLogout}
      />
    );
  }

  return <Dashboard profile={profile} onLogout={handleLogout} />;
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="lion-logo">🦁</div>

        <h1>GBEWAH HOUSE</h1>
        <p>IN UNITY LIES OUR STRENGTH</p>

        <div className="loading-spinner" />
      </div>
    </div>
  );
}

function LoginPage({ onLoginSuccess }) {
  const [role, setRole] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const accounts = role ? STAFF_ACCOUNTS[role] : [];

  function handleRoleSelect(selectedRole) {
    setRole(selectedRole);
    setSelectedAccount(null);
    setPassword("");
    setError("");
  }

  function handleAccountSelect(account) {
    setSelectedAccount(account);
    setPassword("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (!role) {
      setError("Please choose your role.");
      return;
    }

    if (!selectedAccount) {
      setError("Please select your account.");
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setLoggingIn(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: selectedAccount.email,
        password,
      });

    if (loginError) {
      console.error("Login error:", loginError);
      setError("Incorrect password. Please try again.");
      setLoggingIn(false);
      return;
    }

    const success = await onLoginSuccess(data.session);

    if (!success) {
      setError("We could not load your staff account.");
    }

    setLoggingIn(false);
  }

  return (
    <div className="login-page">
      <div className="login-container">

        <div className="login-brand">
          <div className="lion-logo">🦁</div>

          <h1>GBEWAH HOUSE</h1>

          <p className="motto">
            IN UNITY LIES OUR STRENGTH
          </p>

          <div className="brand-divider" />
        </div>

        <div className="login-card">

          <div className="login-heading">
            <span>STAFF PORTAL</span>

            <h2>Welcome</h2>

            <p>
              Select your role and account to access the
              Gbewah House management system.
            </p>
          </div>

          <div className="field-label">LOGIN AS</div>

          <div className="role-buttons">

            <button
              type="button"
              className={`role-card ${
                role === "house_master" ? "active" : ""
              }`}
              onClick={() => handleRoleSelect("house_master")}
            >
              <div className="role-icon">HM</div>

              <div>
                <strong>HOUSE MASTER</strong>
                <span>4 accounts</span>
              </div>
            </button>

            <button
              type="button"
              className={`role-card ${
                role === "prefect" ? "active" : ""
              }`}
              onClick={() => handleRoleSelect("prefect")}
            >
              <div className="role-icon">HP</div>

              <div>
                <strong>HOUSE PREFECT</strong>
                <span>3 accounts</span>
              </div>
            </button>

          </div>

          {role && (
            <>
              <div className="field-label account-field-label">
                SELECT YOUR ACCOUNT
              </div>

              <div className="account-buttons">
                {accounts.map((account) => (
                  <button
                    key={account.key}
                    type="button"
                    className={`account-card ${
                      selectedAccount?.key === account.key
                        ? "active"
                        : ""
                    }`}
                    onClick={() => handleAccountSelect(account)}
                  >
                    <span className="account-number">
                      {account.key.slice(-1)}
                    </span>

                    <span>{account.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {selectedAccount && (
            <form
              className="password-section"
              onSubmit={handleSubmit}
            >
              <div className="selected-account">
                <span>Selected account</span>
                <strong>{selectedAccount.label}</strong>
              </div>

              <label htmlFor="password">
                PASSWORD
              </label>

              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={loggingIn}
              >
                {loggingIn ? "LOGGING IN..." : "LOGIN"}
              </button>
            </form>
          )}

          {error && !selectedAccount && (
            <div className="error-message">
              {error}
            </div>
          )}

        </div>

        <div className="system-footer">
          Gbewah House Student Management System
        </div>

      </div>
    </div>
  );
}

function ChangePasswordPage({
  profile,
  onComplete,
  onLogout,
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    if (newPassword.length < 8) {
      setError(
        "Your new password must be at least 8 characters long."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    const { error: passwordError } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (passwordError) {
      console.error("Password update error:", passwordError);
      setError(passwordError.message);
      setSaving(false);
      return;
    }

    const { error: completeError } =
      await supabase.rpc("complete_first_login");

    if (completeError) {
      console.error(
        "First-login completion error:",
        completeError
      );
      setError(
        "Password changed, but we could not complete your account setup. Please try again."
      );
      setSaving(false);
      return;
    }

    setSuccess(true);

    setTimeout(async () => {
      await onComplete();
    }, 700);
  }

  return (
    <div className="login-page">
      <div className="login-container">

        <div className="login-brand">
          <div className="lion-logo">🦁</div>

          <h1>GBEWAH HOUSE</h1>

          <p className="motto">
            IN UNITY LIES OUR STRENGTH
          </p>

          <div className="brand-divider" />
        </div>

        <div className="login-card">

          <div className="login-heading">
            <span>FIRST LOGIN</span>

            <h2>Create your password</h2>

            <p>
              Welcome, <strong>{profile.full_name}</strong>.
              Create a personal password before continuing.
            </p>
          </div>

          <form
            className="password-section"
            onSubmit={handleSubmit}
          >

            <label htmlFor="new-password">
              NEW PASSWORD
            </label>

            <div className="password-input-wrapper">
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                autoComplete="new-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowNewPassword((value) => !value)
                }
              >
                {showNewPassword ? "HIDE" : "SHOW"}
              </button>
            </div>

            <label htmlFor="confirm-password">
              CONFIRM PASSWORD
            </label>

            <div className="password-input-wrapper">
              <input
                id="confirm-password"
                type={
                  showConfirmPassword ? "text" : "password"
                }
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword((value) => !value)
                }
              >
                {showConfirmPassword ? "HIDE" : "SHOW"}
              </button>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                Password created successfully.
                Opening your dashboard...
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "CREATING PASSWORD..."
                : "CREATE PASSWORD"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={onLogout}
            >
              LOG OUT
            </button>

          </form>

        </div>

      </div>
    </div>
  );
}


function Dashboard({ profile, onLogout }) {
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [dashboardData, setDashboardData] = useState({
    academicYear: null,
    totalStudents: 0,
    registered: 0,
    notRegistered: 0,
    totalPayments: 0,
    rooms: [],
  });
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const navigation = [
    { label: "Dashboard", icon: "⌂" },
    { label: "Students", icon: "◫" },
    { label: "Registration", icon: "✚" },
    { label: "Rooms", icon: "▦" },
    { label: "Payments", icon: "₵" },
    { label: "Reports", icon: "▤" },
    { label: "Academic Year", icon: "◷" },
    { label: "Delete Records", icon: "×" },
    { label: "Monitoring", icon: "◉" },
  ];

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setDashboardLoading(true);

    try {
      const { data: year, error: yearError } = await supabase
        .from("academic_years")
        .select("id, name, registration_fee")
        .eq("is_current", true)
        .single();

      if (yearError) {
        console.error("Academic year error:", yearError);
        return;
      }

      const { data: enrollments, error: enrollmentError } =
        await supabase
          .from("student_enrollments")
          .select("id, registration_status")
          .eq("academic_year_id", year.id);

      if (enrollmentError) {
        console.error("Enrollment error:", enrollmentError);
        return;
      }

      const enrollmentList = enrollments || [];
      const totalStudents = enrollmentList.length;

      const registered = enrollmentList.filter(
        (student) => student.registration_status === "registered"
      ).length;

      const notRegistered = enrollmentList.filter(
        (student) => student.registration_status === "not_registered"
      ).length;

      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select(
          "id, block_number, room_number, allocation_order, capacity"
        )
        .eq("is_active", true)
        .order("allocation_order", { ascending: true });

      if (roomError) {
        console.error("Room error:", roomError);
      }

      const { data: registrations, error: registrationsError } =
        await supabase
          .from("registrations")
          .select(`
            id,
            room_id,
            student_enrollments!inner (
              academic_year_id
            )
          `)
          .eq("student_enrollments.academic_year_id", year.id);

      if (registrationsError) {
        console.error("Registrations error:", registrationsError);
      }

      const registrationList = registrations || [];
      const roomCounts = {};

      registrationList.forEach((registration) => {
        if (!registration.room_id) {
          return;
        }

        roomCounts[registration.room_id] =
          (roomCounts[registration.room_id] || 0) + 1;
      });

      const roomData = (room || []).map((room) => {
        const occupied = roomCounts[room.id] || 0;
        const percentage =
          room.capacity > 0
            ? (occupied / room.capacity) * 100
            : 0;

        return {
          id: room.id,
          block: `Block ${room.block_number}`,
          room: `Room ${room.room_number}`,
          occupied,
          capacity: room.capacity,
          percentage,
        };
      });

      let totalPayments = 0;

      const registrationIds = registrationList.map(
        (registration) => registration.id
      );

      if (registrationIds.length > 0) {
        const { data: payments, error: paymentsError } =
          await supabase
            .from("payments")
            .select("amount")
            .in("registration_id", registrationIds);

        if (paymentsError) {
          console.error("Payments error:", paymentsError);
        } else {
          totalPayments = (payments || []).reduce(
            (total, payment) =>
              total + Number(payment.amount || 0),
            0
          );
        }
      }

      setDashboardData({
        academicYear: year,
        totalStudents,
        registered,
        notRegistered,
        totalPayments,
        rooms: roomData,
      });
    } catch (error) {
      console.error("Dashboard loading error:", error);
    } finally {
      setDashboardLoading(false);
    }
  }

  function openSection(section) {
    setActiveSection(section);
  }

  function renderDashboard() {
    return (
      <>
        <section className="dashboard-welcome">
          <div>
            <span className="welcome-label">STAFF DASHBOARD</span>

            <h3>Welcome back, {profile.full_name}</h3>

            <p>
              Manage Gbewah House registration, students,
              accommodation and payments from one place.
            </p>
          </div>

          <div className="welcome-emblem">🦁</div>
        </section>

        <section className="overview-heading">
          <div>
            <span>OVERVIEW</span>
            <h3>House activity</h3>
          </div>

          <div className="academic-badge">
            <span>ACADEMIC YEAR</span>

            <strong>
              {dashboardData.academicYear?.name || "—"}
            </strong>
          </div>
        </section>

        <section className="dashboard-stats">
          <div className="dashboard-stat">
            <div className="stat-top">
              <span>TOTAL STUDENTS</span>
              <div className="stat-icon">◫</div>
            </div>

            <strong>
              {dashboardLoading
                ? "..."
                : dashboardData.totalStudents}
            </strong>

            <p>Students in current roster</p>
          </div>

          <div className="dashboard-stat">
            <div className="stat-top">
              <span>REGISTERED</span>
              <div className="stat-icon">✓</div>
            </div>

            <strong>
              {dashboardLoading
                ? "..."
                : dashboardData.registered}
            </strong>

            <p>Students registered this year</p>
          </div>

          <div className="dashboard-stat">
            <div className="stat-top">
              <span>NOT REGISTERED</span>
              <div className="stat-icon">!</div>
            </div>

            <strong>
              {dashboardLoading
                ? "..."
                : dashboardData.notRegistered}
            </strong>

            <p>Students awaiting registration</p>
          </div>

          <div className="dashboard-stat">
            <div className="stat-top">
              <span>PAYMENTS</span>
              <div className="stat-icon">₵</div>
            </div>

            <strong>
              {dashboardLoading
                ? "..."
                : `GH₵${dashboardData.totalPayments.toFixed(2)}`}
            </strong>

            <p>Registration fees recorded</p>
          </div>
        </section>

        <section className="dashboard-grid-main">
          <div className="dashboard-panel room-panel">
            <div className="panel-header">
              <div>
                <span>ACCOMMODATION</span>
                <h3>Room occupancy</h3>
              </div>

              <button
                type="button"
                className="panel-action"
                onClick={() => openSection("Rooms")}
              >
                VIEW ALL
              </button>
            </div>

            <div className="rooms-list">
              {dashboardLoading ? (
                <div className="dashboard-loading">
                  Loading room information...
                </div>
              ) : dashboardData.rooms.length === 0 ? (
                <div className="dashboard-loading">
                  No rooms available.
                </div>
              ) : (
                dashboardData.rooms.map((room) => (
                  <div className="room-row" key={room.id}>
                    <div className="room-name">
                      <strong>{room.room}</strong>
                      <span>{room.block}</span>
                    </div>

                    <div className="room-progress">
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${room.percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="room-capacity">
                      <strong>
                        {room.occupied}/{room.capacity}
                      </strong>
                      <span>students</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-panel quick-panel">
            <div className="panel-header">
              <div>
                <span>QUICK ACTIONS</span>
                <h3>Get started</h3>
              </div>
            </div>

            <div className="quick-actions">
              {profile.role === "prefect" && (
                <button
                  type="button"
                  className="quick-action"
                  onClick={() => openSection("Registration")}
                >
                  <div className="quick-action-icon">✚</div>

                  <div>
                    <strong>Register Student</strong>
                    <span>
                      Complete a student registration
                    </span>
                  </div>

                  <b>→</b>
                </button>
              )}

              <button
                type="button"
                className="quick-action"
                onClick={() => openSection("Students")}
              >
                <div className="quick-action-icon">◫</div>

                <div>
                  <strong>View Students</strong>
                  <span>Search the student roster</span>
                </div>

                <b>→</b>
              </button>

              <button
                type="button"
                className="quick-action"
                onClick={() => openSection("Reports")}
              >
                <div className="quick-action-icon">▤</div>

                <div>
                  <strong>View Reports</strong>
                  <span>Review house records</span>
                </div>

                <b>→</b>
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-footer-card">
          <div className="footer-card-lion">🦁</div>

          <div>
            <span>GBEWAH HOUSE</span>
            <h3>IN UNITY LIES OUR STRENGTH</h3>

            <p>
              Student Registration &amp; Accommodation
              Management System
            </p>
          </div>
        </section>
      </>
    );
  }

  function renderModulePage() {
    if (activeSection === "Students") {
      return <Students />;
    }

    if (
      activeSection === "Registration" &&
      profile.role === "prefect"
    ) {
      return <Registration />;
    }

    if (
      activeSection === "Delete Records" &&
      profile.role === "prefect"
    ) {
      return <DeleteRecords />;
    }

    if (
      activeSection === "Monitoring" &&
      profile.role === "house_master"
    ) {
      return <HouseMasterMonitoring />;
    }

    if (activeSection === "Rooms") {
      return <Rooms />;
    }

    if (activeSection === "Payments") {
      return <Payment />;
    }

    if (activeSection === "Reports") {
      return <Reports />;
    }

    if (activeSection === "Academic Year") {
      return <AcademicYear />;
    }

    const moduleInfo = {
      Rooms: {
        eyebrow: "ACCOMMODATION",
        title: "Rooms",
        description:
          "Monitor the six Gbewah House rooms and their 50-student capacity.",
        icon: "▦",
      },

      Payments: {
        eyebrow: "PAYMENT MANAGEMENT",
        title: "Payments",
        description:
          "View registration payments recorded by House Prefects.",
        icon: "₵",
      },

      Reports: {
        eyebrow: "REPORTING",
        title: "Reports",
        description:
          "Review student, registration, room and payment information.",
        icon: "▤",
      },

      "Academic Year": {
        eyebrow: "ACADEMIC YEAR",
        title: "Academic Year",
        description:
          "View and manage the current academic year.",
        icon: "◷",
      },
    };

    const current = moduleInfo[activeSection];

    if (!current) {
      return renderDashboard();
    }

    return (
      <section className="section-page">
        <div className="section-hero">
          <div className="section-hero-icon">
            {current.icon}
          </div>

          <div>
            <span>{current.eyebrow}</span>
            <h3>{current.title}</h3>
            <p>{current.description}</p>
          </div>
        </div>

        <div className="section-placeholder">
          <div className="placeholder-symbol">
            {current.icon}
          </div>

          <h4>{current.title} module</h4>

          <p>
            This module is connected to the dashboard and
            ready for full functionality.
          </p>

          <div className="module-status">
            <span className="status-dot" />
            Module connected
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-lion">🦁</div>

          <div>
            <h1>GBEWAH HOUSE</h1>
            <p>IN UNITY LIES OUR STRENGTH</p>
          </div>
        </div>

        <div className="sidebar-section-label">
          MAIN MENU
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            if (
              profile.role === "house_master" &&
              (item.label === "Registration" ||
                item.label === "Delete Records")
            ) {
              return null;
            }

            if (
              profile.role === "prefect" &&
              item.label === "Monitoring"
            ) {
              return null;
            }

            return (
              <button
                key={item.label}
                type="button"
                className={`sidebar-link ${
                  activeSection === item.label
                    ? "active"
                    : ""
                }`}
                onClick={() => openSection(item.label)}
              >
                <span className="sidebar-icon">
                  {item.icon}
                </span>

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">
              {profile.full_name
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="user-details">
              <strong>{profile.full_name}</strong>

              <span>
                {profile.role === "house_master"
                  ? "House Master"
                  : "House Prefect"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={onLogout}
          >
            <span>↪</span>
            LOG OUT
          </button>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="topbar-label">
              GBEWAH HOUSE MANAGEMENT SYSTEM
            </span>

            <h2>{activeSection}</h2>
          </div>

          <div className="topbar-user">
            <div className="topbar-avatar">
              {profile.full_name
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>{profile.full_name}</strong>

              <span>
                {profile.role === "house_master"
                  ? "House Master"
                  : "House Prefect"}
              </span>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          {renderModulePage()}
        </main>
      </div>
    </div>
  );
}

export default App;
