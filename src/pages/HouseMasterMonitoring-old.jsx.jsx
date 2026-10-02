import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function HouseMasterMonitoring() {
  const [academicYear, setAcademicYear] = useState(null);
  const [records, setRecords] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMonitoringData();
  }, []);

  async function loadMonitoringData() {
    setLoading(true);
    setError("");

    const { data: year, error: yearError } = await supabase
      .from("academic_years")
      .select("id, name")
      .eq("is_current", true)
      .single();

    if (yearError) {
      console.error("Academic year error:", yearError);
      setError("Unable to load the current academic year.");
      setLoading(false);
      return;
    }

    setAcademicYear(year);

    const { data, error: recordsError } = await supabase
      .from("student_enrollments")
      .select(`
        id,
        class_name,
        registration_status,
        students (
          id,
          full_name
        ),
        registrations (
          id,
          reporting_date,
          registered_at,
          room_id,
          registered_by,
          payments (
            amount,
            status,
            paid_at
          ),
          rooms (
            block_number,
            room_number
          ),
          staff_profiles (
            full_name,
            staff_id,
            role
          )
        )
      `)
      .eq("academic_year_id", year.id)
      .order("created_at", { ascending: false });

    if (recordsError) {
      console.error("Monitoring records error:", recordsError);
      setError("Unable to load registration records.");
      setLoading(false);
      return;
    }

    setRecords(data || []);
    setLoading(false);
  }

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const studentName =
        record.students?.full_name?.toLowerCase() || "";

      const className =
        record.class_name?.toLowerCase() || "";

      const matchesSearch =
        !query ||
        studentName.includes(query) ||
        className.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        record.registration_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter]);

  const totalStudents = records.length;

  const registeredCount = records.filter(
    (record) =>
      record.registration_status === "registered"
  ).length;

  const notRegisteredCount = records.filter(
    (record) =>
      record.registration_status === "not_registered"
  ).length;

  const totalPaid = records.reduce((total, record) => {
    if (record.registration_status !== "registered") {
      return total;
    }

    const registration = Array.isArray(record.registrations)
      ? record.registrations[0]
      : record.registrations;

    const payment = registration?.payments;

    if (Array.isArray(payment)) {
      return (
        total +
        payment.reduce(
          (sum, item) =>
            sum + Number(item.amount || 0),
          0
        )
      );
    }

    return total + Number(payment?.amount || 0);
  }, 0);

  return (
    <section className="monitoring-page">

      {/* HEADER */}
      <div className="monitoring-header">
        <div className="monitoring-header-icon">
          ◉
        </div>

        <div>
          <span>HOUSE MASTER OVERSIGHT</span>

          <h3>Registration Monitoring</h3>

          <p>
            Monitor student registration activity,
            payments, rooms and the staff member who
            completed each registration.
          </p>
        </div>

        <div className="monitoring-year">
          <span>ACADEMIC YEAR</span>
          <strong>
            {academicYear?.name || "—"}
          </strong>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="monitoring-summary">

        <div className="monitoring-stat">
          <span>TOTAL STUDENTS</span>
          <strong>{totalStudents}</strong>
          <p>Current roster</p>
        </div>

        <div className="monitoring-stat">
          <span>REGISTERED</span>
          <strong>{registeredCount}</strong>
          <p>Completed</p>
        </div>

        <div className="monitoring-stat">
          <span>NOT REGISTERED</span>
          <strong>{notRegisteredCount}</strong>
          <p>Awaiting reporting</p>
        </div>

        <div className="monitoring-stat">
          <span>FEES COLLECTED</span>
          <strong>
            GH₵{totalPaid.toFixed(2)}
          </strong>
          <p>Recorded payments</p>
        </div>

      </div>

      {/* FILTERS */}
      <div className="monitoring-toolbar">

        <div className="monitoring-search">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search by student or class..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
        >
          <option value="all">
            All Students
          </option>

          <option value="registered">
            Registered
          </option>

          <option value="not_registered">
            Not Registered
          </option>
        </select>

        <button
          type="button"
          className="monitoring-refresh"
          onClick={loadMonitoringData}
        >
          ↻ REFRESH
        </button>

      </div>

      {/* ERROR */}
      {error && (
        <div className="monitoring-error">
          {error}
        </div>
      )}

      {/* TABLE */}
      <div className="monitoring-card">

        <div className="monitoring-card-heading">
          <div>
            <span>REGISTRATION ACTIVITY</span>

            <h4>
              Student oversight
            </h4>
          </div>

          <strong>
            {filteredRecords.length} record
            {filteredRecords.length !== 1
              ? "s"
              : ""}
          </strong>
        </div>

        {loading ? (
          <div className="monitoring-empty">
            <div className="table-spinner" />

            <p>
              Loading registration activity...
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="monitoring-empty">
            <div className="monitoring-empty-icon">
              ◉
            </div>

            <h4>
              No records found
            </h4>

            <p>
              There are no students matching the
              current filters.
            </p>
          </div>
        ) : (
          <div className="monitoring-table-wrapper">

            <table className="monitoring-table">

              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>CLASS</th>
                  <th>STATUS</th>
                  <th>ROOM</th>
                  <th>PAYMENT</th>
                  <th>REGISTERED BY</th>
                  <th>DATE</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => {
                  const registration = Array.isArray(
                    record.registrations
                  )
                    ? record.registrations[0]
                    : record.registrations;

                  const staff = Array.isArray(
                    registration?.staff_profiles
                  )
                    ? registration.staff_profiles[0]
                    : registration?.staff_profiles;

                  const payment = Array.isArray(
                    registration?.payments
                  )
                    ? registration.payments[0]
                    : registration?.payments;

                  const room = Array.isArray(
                    registration?.rooms
                  )
                    ? registration.rooms[0]
                    : registration?.rooms;

                  const isRegistered =
                    record.registration_status ===
                    "registered";

                  return (
                    <tr key={record.id}>

                      {/* STUDENT */}
                      <td>
                        <div className="monitoring-student">
                          <div className="monitoring-avatar">
                            {record.students?.full_name
                              ?.charAt(0)
                              ?.toUpperCase() || "?"}
                          </div>

                          <strong>
                            {record.students?.full_name ||
                              "Unknown student"}
                          </strong>
                        </div>
                      </td>

                      {/* CLASS */}
                      <td>
                        <span className="monitoring-class">
                          {record.class_name}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td>
                        {isRegistered ? (
                          <span className="monitoring-status registered">
                            <i />
                            REGISTERED
                          </span>
                        ) : (
                          <span className="monitoring-status not-registered">
                            <i />
                            NOT REGISTERED
                          </span>
                        )}
                      </td>

                      {/* ROOM */}
                      <td>
                        {room ? (
                          <div className="monitoring-room">
                            <strong>
                              Room {room.room_number}
                            </strong>

                            <span>
                              Block {room.block_number}
                            </span>
                          </div>
                        ) : (
                          <span className="monitoring-muted">
                            —
                          </span>
                        )}
                      </td>

                      {/* PAYMENT */}
                      <td>
                        {payment ? (
                          <div className="monitoring-payment">
                            <strong>
                              GH₵
                              {Number(
                                payment.amount || 0
                              ).toFixed(2)}
                            </strong>

                            <span>
                              {payment.status?.toUpperCase()}
                            </span>
                          </div>
                        ) : (
                          <span className="monitoring-muted">
                            —
                          </span>
                        )}
                      </td>

                      {/* REGISTERED BY */}
                      <td>
                        {staff ? (
                          <div className="monitoring-staff">
                            <strong>
                              {staff.full_name}
                            </strong>

                            <span>
                              {staff.staff_id}
                            </span>
                          </div>
                        ) : (
                          <span className="monitoring-muted">
                            —
                          </span>
                        )}
                      </td>

                      {/* DATE */}
                      <td>
                        {registration?.reporting_date ? (
                          <div className="monitoring-date">
                            <strong>
                              {registration.reporting_date}
                            </strong>

                            <span>
                              {registration.registered_at
                                ? new Date(
                                    registration.registered_at
                                  ).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="monitoring-muted">
                            —
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* OVERSIGHT NOTE */}
      <div className="monitoring-note">
        <div className="monitoring-note-icon">
          🦁
        </div>

        <div>
          <strong>
            House Master Oversight
          </strong>

          <p>
            This section is for monitoring only.
            Registration and payment actions remain
            available to House Prefects.
          </p>
        </div>
      </div>

    </section>
  );
}

export default HouseMasterMonitoring;