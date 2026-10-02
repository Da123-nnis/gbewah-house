import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Payment.css";

function Payment() {
  const [academicYear, setAcademicYear] = useState(null);
  const [records, setRecords] = useState([]);
  const [payments, setPayments] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    setError("");

    const { data: year, error: yearError } = await supabase
      .from("academic_years")
      .select("id, name, registration_fee")
      .eq("is_current", true)
      .single();

    if (yearError) {
      console.error("Academic year error:", yearError);
      setError("Unable to load the current academic year.");
      setLoading(false);
      return;
    }

    setAcademicYear(year);

    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .select(
        `
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
            registered_by,
            room_id,
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
        `
      )
      .eq("academic_year_id", year.id)
      .order("created_at", { ascending: false });

    if (enrollmentError) {
      console.error("Registration records error:", enrollmentError);
      setError("Unable to load registration records.");
      setLoading(false);
      return;
    }

    const enrollmentList = enrollmentRows || [];

    const registrationRows = enrollmentList.flatMap((enrollment) => {
      const registration = Array.isArray(enrollment.registrations)
        ? enrollment.registrations[0]
        : enrollment.registrations;

      if (!registration?.id) {
        return [];
      }

      return [
        {
          ...registration,
          enrollmentId: enrollment.id,
          className: enrollment.class_name,
          registrationStatus: enrollment.registration_status,
          student: Array.isArray(enrollment.students)
            ? enrollment.students[0]
            : enrollment.students,
        },
      ];
    });

    setRecords(enrollmentList);

    if (registrationRows.length === 0) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const registrationIds = registrationRows.map(
      (registration) => registration.id
    );

    const { data: paymentRows, error: paymentsError } = await supabase
      .from("payments")
      .select("id, amount, status, registration_id")
      .in("registration_id", registrationIds);

    if (paymentsError) {
      console.error("Payments error:", paymentsError);
      setError("Unable to load payment records.");
      setLoading(false);
      return;
    }

    const registrationMap = new Map(
      registrationRows.map((registration) => [registration.id, registration])
    );

    const normalized = (paymentRows || []).map((payment) => {
      const registration = registrationMap.get(payment.registration_id);
      const room = Array.isArray(registration?.rooms)
        ? registration.rooms[0]
        : registration?.rooms;
      const staff = Array.isArray(registration?.staff_profiles)
        ? registration.staff_profiles[0]
        : registration?.staff_profiles;

      return {
        ...payment,
        studentName: registration?.student?.full_name || "Unknown student",
        className: registration?.className || "—",
        block: room?.block_number ? `Block ${room.block_number}` : "—",
        room: room?.room_number ? `Room ${room.room_number}` : "—",
        registeredBy: staff?.full_name || "—",
        staffId: staff?.staff_id || "—",
        registeredAt: registration?.registered_at || null,
        reportingDate: registration?.reporting_date || null,
        paymentStatus: payment.status || "recorded",
      };
    });

    setPayments(normalized);
    setLoading(false);
  }

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !query ||
        payment.studentName.toLowerCase().includes(query) ||
        payment.className.toLowerCase().includes(query) ||
        payment.room.toLowerCase().includes(query) ||
        payment.registeredBy.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || payment.paymentStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, search, statusFilter]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(payments.map((payment) => payment.paymentStatus).filter(Boolean))
    );
  }, [payments]);

  const totalCollected = useMemo(() => {
    return payments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );
  }, [payments]);

  const registeredCount = useMemo(() => {
    return records.filter(
      (record) => record.registration_status === "registered"
    ).length;
  }, [records]);

  const registrationFee = Number(academicYear?.registration_fee || 0);
  const expectedFees = registeredCount * registrationFee;
  const outstanding = Math.max(expectedFees - totalCollected, 0);

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusLabel(status) {
    return (status || "recorded")
      .replaceAll("_", " ")
      .toUpperCase();
  }

  return (
    <section className="payments-page">
      <div className="payments-header">
        <div className="payments-header-icon">₵</div>

        <div>
          <span>PAYMENT MANAGEMENT</span>
          <h3>Registration Payments</h3>
          <p>
            Review registration fees recorded for Gbewah House students.
          </p>
        </div>

        <div className="payments-year-card">
          <span>ACADEMIC YEAR</span>
          <strong>{academicYear?.name || "—"}</strong>
        </div>
      </div>

      <div className="payments-summary">
        <div className="payments-stat">
          <span>TOTAL COLLECTED</span>
          <strong>GH₵{totalCollected.toFixed(2)}</strong>
          <p>Recorded payments</p>
        </div>

        <div className="payments-stat">
          <span>STUDENTS PAID</span>
          <strong>{payments.length}</strong>
          <p>Payment records</p>
        </div>

        <div className="payments-stat">
          <span>REGISTRATION FEE</span>
          <strong>GH₵{registrationFee.toFixed(2)}</strong>
          <p>Current academic year</p>
        </div>

        <div className="payments-stat">
          <span>OUTSTANDING</span>
          <strong>GH₵{outstanding.toFixed(2)}</strong>
          <p>Against registered students</p>
        </div>
      </div>

      <div className="payments-toolbar">
        <div className="payments-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search by student, class, room or staff..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Payments</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="payments-refresh"
          onClick={loadPayments}
        >
          ↻ REFRESH
        </button>
      </div>

      {error && <div className="payments-error">{error}</div>}

      <div className="payments-table-card">
        <div className="payments-table-head">
          <div>
            <span>PAYMENT RECORDS</span>
            <h4>{filteredPayments.length} record(s)</h4>
          </div>

          {loading && <span className="payments-loading">Loading…</span>}
        </div>

        {!loading && filteredPayments.length === 0 ? (
          <div className="payments-empty">
            <div className="payments-empty-icon">₵</div>
            <h4>No payment records found</h4>
            <p>
              Payment entries will appear here after registered students have
              completed the GH₵10 registration process.
            </p>
          </div>
        ) : (
          <div className="payments-table-wrap">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>CLASS</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>ROOM</th>
                  <th>REPORTING DATE</th>
                  <th>REGISTERED BY</th>
                  <th>REGISTRATION TIME</th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <div className="payment-student">
                        <strong>{payment.studentName}</strong>
                        <span>
                          Ref: {payment.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td>{payment.className}</td>
                    <td>
                      <strong>
                        GH₵{Number(payment.amount || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`payment-status payment-status-${payment.paymentStatus
                          .toLowerCase()
                          .replaceAll("_", "-")}`}
                      >
                        {statusLabel(payment.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      {payment.block !== "—" && payment.room !== "—"
                        ? `${payment.block} · ${payment.room}`
                        : "—"}
                    </td>
                    <td>{formatDate(payment.reportingDate)}</td>
                    <td>
                      <div className="payment-staff">
                        <strong>{payment.registeredBy}</strong>
                        <span>{payment.staffId}</span>
                      </div>
                    </td>
                    <td>{formatDateTime(payment.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default Payment;
