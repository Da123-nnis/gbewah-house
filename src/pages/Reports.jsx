
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Reports.css";

function Reports() {
  const [academicYear, setAcademicYear] = useState(null);
  const [rows, setRows] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadReportData();
  }, []);

  async function fetchRegistrations(enrollmentIds) {
    if (enrollmentIds.length === 0) {
      return { data: [], error: null };
    }

    const primary = await supabase
      .from("registrations")
      .select(
        "id, student_enrollment_id, room_id, registered_by, reporting_date, registered_at"
      )
      .in("student_enrollment_id", enrollmentIds)
      .order("registered_at", { ascending: false });

    if (!primary.error) {
      return primary;
    }

    console.warn(
      "Primary registration lookup failed. Trying enrollment_id fallback.",
      primary.error
    );

    const fallback = await supabase
      .from("registrations")
      .select(
        "id, enrollment_id, room_id, registered_by, reporting_date, registered_at"
      )
      .in("enrollment_id", enrollmentIds)
      .order("registered_at", { ascending: false });

    if (!fallback.error) {
      return {
        data: (fallback.data || []).map((registration) => ({
          ...registration,
          student_enrollment_id: registration.enrollment_id,
        })),
        error: null,
      };
    }

    return primary;
  }

  async function loadReportData() {
    setLoading(true);
    setError("");

    try {
      const { data: year, error: yearError } = await supabase
        .from("academic_years")
        .select("id, name, registration_fee, start_date")
        .eq("is_current", true)
        .single();

      if (yearError) {
        throw new Error("Unable to load the current academic year.");
      }

      setAcademicYear(year);

      const [
        enrollmentResult,
        roomResult,
      ] = await Promise.all([
        supabase
          .from("student_enrollments")
          .select(`
            id,
            class_name,
            registration_status,
            students (
              full_name
            )
          `)
          .eq("academic_year_id", year.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("rooms")
          .select(
            "id, block_number, room_number, allocation_order, capacity"
          )
          .eq("is_active", true)
          .order("allocation_order", { ascending: true }),
      ]);

      if (enrollmentResult.error) {
        throw new Error("Unable to load the student roster.");
      }

      if (roomResult.error) {
        throw new Error("Unable to load room information.");
      }

      const enrollmentList = enrollmentResult.data || [];
      const enrollmentIds = enrollmentList.map((item) => item.id);
      const roomList = roomResult.data || [];

      const registrationResult = await fetchRegistrations(enrollmentIds);

      if (registrationResult.error) {
        console.error(
          "Reports registration query error:",
          registrationResult.error
        );
        throw new Error(
          "Unable to load registration records. Check the browser console for the database error."
        );
      }

      const registrationList = registrationResult.data || [];
      const registrationIds = registrationList.map((item) => item.id);

      let paymentList = [];
      if (registrationIds.length > 0) {
        const { data: payments, error: paymentsError } = await supabase
          .from("payments")
          .select("id, registration_id, amount, status")
          .in("registration_id", registrationIds);

        if (paymentsError) {
          console.error("Reports payments error:", paymentsError);
        } else {
          paymentList = payments || [];
        }
      }

      const staffIds = [
        ...new Set(
          registrationList
            .map((registration) => registration.registered_by)
            .filter(Boolean)
        ),
      ];

      let staffList = [];
      if (staffIds.length > 0) {
        const { data: staffProfiles, error: staffError } = await supabase
          .from("staff_profiles")
          .select("id, staff_id, full_name, role")
          .in("id", staffIds);

        if (staffError) {
          console.error("Reports staff error:", staffError);
        } else {
          staffList = staffProfiles || [];
        }
      }

      const registrationByEnrollment = new Map(
        registrationList.map((registration) => [
          registration.student_enrollment_id,
          registration,
        ])
      );

      const paymentByRegistration = new Map(
        paymentList.map((payment) => [payment.registration_id, payment])
      );

      const roomById = new Map(
        roomList.map((room) => [room.id, room])
      );

      const staffById = new Map(
        staffList.map((member) => [member.id, member])
      );

      const reportRows = enrollmentList.map((enrollment) => {
        const registration = registrationByEnrollment.get(enrollment.id);
        const payment = registration
          ? paymentByRegistration.get(registration.id)
          : null;
        const room = registration
          ? roomById.get(registration.room_id)
          : null;
        const staffMember = registration
          ? staffById.get(registration.registered_by)
          : null;

        const student = Array.isArray(enrollment.students)
          ? enrollment.students[0]
          : enrollment.students;

        return {
          id: enrollment.id,
          studentName: student?.full_name || "Unknown student",
          className: enrollment.class_name || "—",
          registrationStatus:
            enrollment.registration_status || "not_registered",
          registration,
          payment,
          room,
          staffMember,
        };
      });

      setRooms(roomList);
      setRows(reportRows);
    } catch (loadError) {
      console.error("Reports loading error:", loadError);
      setError(
        loadError?.message ||
          "Unable to load reports right now."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    loadReportData();
  }

  const summary = useMemo(() => {
    const totalStudents = rows.length;

    const registered = rows.filter(
      (row) => row.registrationStatus === "registered"
    ).length;

    const notRegistered = totalStudents - registered;

    const fee = Number(academicYear?.registration_fee || 0);

    const totalCollected = rows.reduce(
      (total, row) => total + Number(row.payment?.amount || 0),
      0
    );

    const expectedFees = registered * fee;
    const outstandingFees = Math.max(
      expectedFees - totalCollected,
      0
    );

    const totalCapacity = rooms.reduce(
      (total, room) => total + Number(room.capacity || 0),
      0
    );

    const occupied = rows.filter(
      (row) => row.registrationStatus === "registered" && row.room
    ).length;

    const availableSpaces = Math.max(
      totalCapacity - occupied,
      0
    );

    const occupancyRate =
      totalCapacity > 0
        ? (occupied / totalCapacity) * 100
        : 0;

    return {
      totalStudents,
      registered,
      notRegistered,
      fee,
      totalCollected,
      expectedFees,
      outstandingFees,
      totalCapacity,
      occupied,
      availableSpaces,
      occupancyRate,
    };
  }, [rows, rooms, academicYear]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        row.studentName.toLowerCase().includes(query) ||
        row.className.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        row.registrationStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const prefectActivity = useMemo(() => {
    const counts = new Map();

    rows.forEach((row) => {
      const staffMember = row.staffMember;
      if (!staffMember) return;

      const existing = counts.get(staffMember.id) || {
        staffMember,
        registrations: 0,
        fees: 0,
      };

      if (row.registration) {
        existing.registrations += 1;
      }

      existing.fees += Number(row.payment?.amount || 0);
      counts.set(staffMember.id, existing);
    });

    return [...counts.values()].sort(
      (a, b) => b.registrations - a.registrations
    );
  }, [rows]);

  function formatDate(value) {
    if (!value) return "—";

    return new Date(value).toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <section className="reports-page">
      <div className="reports-hero">
        <div className="reports-hero-icon">▤</div>

        <div className="reports-hero-copy">
          <span>HOUSE REPORTING</span>

          <h3>Reports &amp; overview</h3>

          <p>
            A consolidated view of registration, accommodation,
            payments and staff activity for the current academic year.
          </p>
        </div>

        <div className="reports-year-card">
          <span>ACADEMIC YEAR</span>
          <strong>{academicYear?.name || "—"}</strong>
        </div>
      </div>

      {error && (
        <div className="reports-error">
          {error}
        </div>
      )}

      <div className="reports-summary-grid">
        <div className="reports-summary-card">
          <span>TOTAL STUDENTS</span>
          <strong>
            {loading ? "..." : summary.totalStudents}
          </strong>
          <p>Current roster</p>
        </div>

        <div className="reports-summary-card">
          <span>REGISTERED</span>
          <strong>
            {loading ? "..." : summary.registered}
          </strong>
          <p>
            {loading
              ? ""
              : `${summary.notRegistered} awaiting registration`}
          </p>
        </div>

        <div className="reports-summary-card">
          <span>FEES COLLECTED</span>
          <strong>
            {loading
              ? "..."
              : `GH₵${summary.totalCollected.toFixed(2)}`}
          </strong>
          <p>Recorded registration payments</p>
        </div>

        <div className="reports-summary-card">
          <span>AVAILABLE SPACES</span>
          <strong>
            {loading ? "..." : summary.availableSpaces}
          </strong>
          <p>
            {loading
              ? ""
              : `${summary.occupancyRate.toFixed(1)}% overall occupancy`}
          </p>
        </div>
      </div>

      <div className="reports-grid">
        <div className="reports-panel">
          <div className="reports-panel-header">
            <div>
              <span>FINANCIAL REPORT</span>
              <h4>Registration fees</h4>
            </div>

            <div className="reports-fee-badge">
              GH₵{summary.fee.toFixed(2)} / student
            </div>
          </div>

          <div className="reports-finance-list">
            <div>
              <span>Expected from registered students</span>
              <strong>
                GH₵{summary.expectedFees.toFixed(2)}
              </strong>
            </div>

            <div>
              <span>Collected</span>
              <strong>
                GH₵{summary.totalCollected.toFixed(2)}
              </strong>
            </div>

            <div>
              <span>Outstanding</span>
              <strong>
                GH₵{summary.outstandingFees.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>

        <div className="reports-panel">
          <div className="reports-panel-header">
            <div>
              <span>ACCOMMODATION REPORT</span>
              <h4>House capacity</h4>
            </div>
          </div>

          <div className="reports-capacity-top">
            <strong>
              {summary.occupied}/{summary.totalCapacity}
            </strong>
            <span>spaces occupied</span>
          </div>

          <div className="reports-capacity-track">
            <div
              className="reports-capacity-fill"
              style={{
                width: `${Math.min(
                  summary.occupancyRate,
                  100
                )}%`,
              }}
            />
          </div>

          <div className="reports-capacity-footer">
            <span>
              {summary.availableSpaces} spaces available
            </span>
            <span>{rooms.length} rooms active</span>
          </div>
        </div>
      </div>

      <div className="reports-panel reports-table-panel">
        <div className="reports-panel-header reports-table-heading">
          <div>
            <span>STUDENT REPORT</span>
            <h4>Registration overview</h4>
          </div>

          <div className="reports-actions">
            <div className="reports-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search student or class..."
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
              <option value="all">All students</option>
              <option value="registered">Registered</option>
              <option value="not_registered">
                Not registered
              </option>
            </select>

            <button
              type="button"
              className="reports-refresh"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? "REFRESHING..." : "↻ REFRESH"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="reports-empty">
            <div className="reports-spinner" />

            <h4>Loading report data...</h4>

            <p>
              Gathering student, room and payment information.
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="reports-empty">
            <div className="reports-empty-icon">▤</div>

            <h4>No matching records</h4>

            <p>
              Try a different search or status filter.
            </p>
          </div>
        ) : (
          <div className="reports-table-wrapper">
            <table className="reports-table">
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
                {filteredRows.map((row) => {
                  const registered =
                    row.registrationStatus === "registered";

                  const room = row.room;
                  const staffMember = row.staffMember;

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="reports-student-cell">
                          <div className="reports-avatar">
                            {row.studentName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <strong>
                            {row.studentName}
                          </strong>
                        </div>
                      </td>

                      <td>
                        <span className="reports-class-chip">
                          {row.className}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`reports-status ${
                            registered
                              ? "registered"
                              : "pending"
                          }`}
                        >
                          {registered
                            ? "REGISTERED"
                            : "NOT REGISTERED"}
                        </span>
                      </td>

                      <td>
                        {room ? (
                          <div className="reports-room-cell">
                            <strong>
                              Room {room.room_number}
                            </strong>

                            <span>
                              Block {room.block_number}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        {row.payment ? (
                          <div className="reports-payment-cell">
                            <strong>
                              GH₵
                              {Number(
                                row.payment.amount || 0
                              ).toFixed(2)}
                            </strong>

                            <span>
                              {row.payment.status ||
                                "Recorded"}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        {staffMember ? (
                          <div className="reports-staff-cell">
                            <strong>
                              {staffMember.full_name}
                            </strong>

                            <span>
                              {staffMember.staff_id}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        <div className="reports-date-cell">
                          <strong>
                            {formatDate(
                              row.registration?.reporting_date
                            )}
                          </strong>

                          <span>
                            {formatDateTime(
                              row.registration?.registered_at
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="reports-grid reports-bottom-grid">
        <div className="reports-panel">
          <div className="reports-panel-header">
            <div>
              <span>ROOM BREAKDOWN</span>
              <h4>Occupancy by room</h4>
            </div>
          </div>

          <div className="reports-room-list">
            {rooms.map((room) => {
              const occupied = rows.filter(
                (row) => row.room?.id === room.id
              ).length;

              const percentage =
                room.capacity > 0
                  ? (occupied / room.capacity) * 100
                  : 0;

              return (
                <div
                  className="reports-room-row"
                  key={room.id}
                >
                  <div>
                    <strong>
                      Block {room.block_number} · Room{" "}
                      {room.room_number}
                    </strong>

                    <span>
                      {occupied}/{room.capacity} students
                    </span>
                  </div>

                  <div className="reports-room-bar">
                    <div
                      className="reports-room-bar-fill"
                      style={{
                        width: `${Math.min(
                          percentage,
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <strong>
                    {percentage.toFixed(0)}%
                  </strong>
                </div>
              );
            })}
          </div>
        </div>

        <div className="reports-panel">
          <div className="reports-panel-header">
            <div>
              <span>STAFF ACTIVITY</span>
              <h4>Prefect registration activity</h4>
            </div>
          </div>

          {prefectActivity.length === 0 ? (
            <div className="reports-activity-empty">
              No registration activity recorded yet.
            </div>
          ) : (
            <div className="reports-activity-list">
              {prefectActivity.map((item) => (
                <div
                  className="reports-activity-row"
                  key={item.staffMember.id}
                >
                  <div className="reports-activity-avatar">
                    {item.staffMember.full_name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>
                      {item.staffMember.full_name}
                    </strong>

                    <span>
                      {item.staffMember.staff_id}
                    </span>
                  </div>

                  <div className="reports-activity-count">
                    <strong>
                      {item.registrations}
                    </strong>

                    <span>registrations</span>
                  </div>

                  <div className="reports-activity-fees">
                    <strong>
                      GH₵{item.fees.toFixed(2)}
                    </strong>

                    <span>fees</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="reports-note">
        <div className="reports-note-icon">🦁</div>

        <div>
          <strong>GBEWAH HOUSE REPORTING</strong>

          <p>
            Reports are generated from the current academic year
            and reflect the registration records stored in the system.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Reports;
