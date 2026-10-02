
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AcademicYear.css";

function AcademicYear() {
  const [currentYear, setCurrentYear] = useState(null);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAcademicYears();
  }, []);

  async function loadAcademicYears() {
    setLoading(true);
    setError("");

    try {
      const { data, error: yearsError } = await supabase
        .from("academic_years")
        .select("id, name, start_date, registration_fee, is_current")
        .order("start_date", { ascending: false });

      if (yearsError) {
        console.error("Academic years error:", yearsError);
        throw new Error(
          "Unable to load academic year information."
        );
      }

      const list = data || [];
      const active = list.find((year) => year.is_current) || null;

      setYears(list);
      setCurrentYear(active);
    } catch (loadError) {
      console.error("Academic year loading error:", loadError);
      setError(
        loadError?.message ||
          "Unable to load academic year information."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadAcademicYears();
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const currentFee = Number(
    currentYear?.registration_fee || 0
  );

  const previousYears = years.filter(
    (year) => !year.is_current
  );

  return (
    <section className="academic-year-page">
      <div className="academic-year-header">
        <div className="academic-year-header-icon">◷</div>

        <div className="academic-year-header-copy">
          <span>ACADEMIC YEAR</span>
          <h3>Academic year overview</h3>
          <p>
            View the active academic year, registration fee and
            previous academic-year records.
          </p>
        </div>

        <button
          type="button"
          className="academic-year-refresh"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? "REFRESHING..." : "↻ REFRESH"}
        </button>
      </div>

      {error && (
        <div className="academic-year-error">
          {error}
        </div>
      )}

      <div className="academic-year-current">
        <div className="academic-year-current-copy">
          <div className="academic-year-eyebrow-row">
            <span>CURRENT ACADEMIC YEAR</span>

            {currentYear && (
              <span className="academic-year-active-badge">
                ACTIVE
              </span>
            )}
          </div>

          <h4>
            {loading
              ? "Loading..."
              : currentYear?.name || "No current year"}
          </h4>

          <p>
            The active year controls which student registrations,
            payments and accommodation records the system displays.
          </p>
        </div>

        <div className="academic-year-current-stats">
          <div className="academic-year-stat">
            <span>START DATE</span>
            <strong>
              {loading
                ? "..."
                : formatDate(currentYear?.start_date)}
            </strong>
          </div>

          <div className="academic-year-stat">
            <span>REGISTRATION FEE</span>
            <strong>
              {loading
                ? "..."
                : `GH₵${currentFee.toFixed(2)}`}
            </strong>
          </div>
        </div>
      </div>

      <div className="academic-year-section">
        <div className="academic-year-section-heading">
          <div>
            <span>YEAR RECORDS</span>
            <h4>Academic year history</h4>
          </div>

          <strong>
            {loading
              ? "..."
              : `${years.length} year${
                  years.length === 1 ? "" : "s"
                }`}
          </strong>
        </div>

        {loading ? (
          <div className="academic-year-empty">
            <div className="academic-year-spinner" />
            <h5>Loading academic years...</h5>
            <p>Retrieving year records from the system.</p>
          </div>
        ) : years.length === 0 ? (
          <div className="academic-year-empty">
            <div className="academic-year-empty-icon">◷</div>
            <h5>No academic years found</h5>
            <p>
              There are no academic-year records available yet.
            </p>
          </div>
        ) : (
          <div className="academic-year-table-wrapper">
            <table className="academic-year-table">
              <thead>
                <tr>
                  <th>ACADEMIC YEAR</th>
                  <th>START DATE</th>
                  <th>REGISTRATION FEE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {years.map((year) => (
                  <tr key={year.id}>
                    <td>
                      <div className="academic-year-name-cell">
                        <strong>{year.name}</strong>

                        {year.is_current && (
                          <small>Current year</small>
                        )}
                      </div>
                    </td>

                    <td>{formatDate(year.start_date)}</td>

                    <td>
                      <strong>
                        GH₵
                        {Number(
                          year.registration_fee || 0
                        ).toFixed(2)}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`academic-year-status ${
                          year.is_current
                            ? "current"
                            : "previous"
                        }`}
                      >
                        {year.is_current
                          ? "CURRENT"
                          : "PREVIOUS"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="academic-year-note">
        <div className="academic-year-note-icon">🦁</div>

        <div>
          <strong>GBEWAH HOUSE ACADEMIC YEAR</strong>
          <p>
            Academic-year records are kept separately so
            historical registration and payment information can
            remain associated with the correct school year.
          </p>
        </div>
      </div>
    </section>
  );
}

export default AcademicYear;
