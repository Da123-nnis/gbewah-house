import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function Registration() {
  const [academicYear, setAcademicYear] = useState(null);
  const [students, setStudents] = useState([]);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [search, setSearch] = useState("");

  const [reportingDate, setReportingDate] = useState(getToday());
  const [parentPhone, setParentPhone] = useState("");
  const [nhisNumber, setNhisNumber] = useState("");

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadRegistrationData();
  }, []);

  async function loadRegistrationData() {
    setLoading(true);
    setError("");

    const { data: year, error: yearError } = await supabase
      .from("academic_years")
      .select("id, name, registration_fee")
      .eq("is_current", true)
      .single();

    if (yearError) {
      console.error("Academic year error:", yearError);

      setError(
        "No current academic year is available."
      );

      setLoading(false);
      return;
    }

    setAcademicYear(year);

    const { data, error: studentsError } = await supabase
      .from("student_enrollments")
      .select(`
        id,
        class_name,
        registration_status,
        students (
          id,
          full_name
        )
      `)
      .eq("academic_year_id", year.id)
      .eq("registration_status", "not_registered")
      .order("created_at", { ascending: true });

    if (studentsError) {
      console.error(
        "Registration students error:",
        studentsError
      );

      setError(
        "Unable to load students awaiting registration."
      );

      setLoading(false);
      return;
    }

    setStudents(data || []);
    setLoading(false);
  }

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return students.filter((enrollment) => {
      const name =
        enrollment.students?.full_name?.toLowerCase() || "";

      const className =
        enrollment.class_name?.toLowerCase() || "";

      return (
        !normalizedSearch ||
        name.includes(normalizedSearch) ||
        className.includes(normalizedSearch)
      );
    });
  }, [students, search]);

  function chooseStudent(enrollment) {
    setSelectedStudent(enrollment);
    setError("");
    setSuccess(null);
    setParentPhone("");
    setNhisNumber("");
    setReportingDate(getToday());
  }

  async function handleRegistration(event) {
    event.preventDefault();

    setError("");
    setSuccess(null);

    if (!selectedStudent) {
      setError("Please select a student first.");
      return;
    }

    if (!reportingDate) {
      setError("Please enter the reporting date.");
      return;
    }

    const cleanParentPhone = parentPhone.trim();
    const cleanNhisNumber = nhisNumber.trim();

    if (!cleanParentPhone) {
      setError(
        "Please enter the parent or guardian phone number."
      );
      return;
    }

    if (!cleanNhisNumber) {
      setError(
        "Please enter the student's NHIS membership number."
      );
      return;
    }

    setRegistering(true);

    const { data, error: registrationError } =
      await supabase.rpc("register_student", {
        p_enrollment_id: selectedStudent.id,
        p_reporting_date: reportingDate,
        p_parent_phone: cleanParentPhone,
        p_nhis_number: cleanNhisNumber,
      });

    if (registrationError) {
      console.error(
        "Registration error:",
        registrationError
      );

      setError(
        registrationError.message ||
          "Student registration failed."
      );

      setRegistering(false);
      return;
    }

    const result = Array.isArray(data)
      ? data[0]
      : data;

    if (!result) {
      setError(
        "Registration completed, but no room information was returned."
      );

      setRegistering(false);
      return;
    }

    setSuccess({
      studentName:
        selectedStudent.students?.full_name || "Student",
      className: selectedStudent.class_name,
      blockNumber: result.block_number,
      roomNumber: result.room_number,
      amount: academicYear?.registration_fee ?? 10,
    });

    setParentPhone("");
    setNhisNumber("");
    setReportingDate(getToday());
    setSelectedStudent(null);
    setSearch("");

    setRegistering(false);

    await loadRegistrationData();
  }

  if (loading) {
    return (
      <section className="registration-page">
        <div className="registration-loading">
          <div className="table-spinner" />

          <p>
            Loading registration information...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="registration-page">

      {/* PAGE HEADER */}
      <div className="registration-header">
        <div className="registration-header-icon">
          ✚
        </div>

        <div>
          <span>STUDENT REGISTRATION</span>

          <h3>Register a Student</h3>

          <p>
            Complete a student's reporting registration
            for the current academic year.
          </p>
        </div>

        <div className="registration-year">
          <span>ACADEMIC YEAR</span>

          <strong>
            {academicYear?.name || "—"}
          </strong>
        </div>
      </div>

      {/* SUCCESS */}
      {success && (
        <div className="registration-success">

          <div className="success-check">
            ✓
          </div>

          <div className="success-content">

            <span>REGISTRATION COMPLETE</span>

            <h4>
              {success.studentName} is now registered.
            </h4>

            <p>
              {success.className} ·{" "}
              GH₵{Number(success.amount).toFixed(2)} paid
            </p>

          </div>

          <div className="assigned-room">
            <span>ASSIGNED ROOM</span>

            <strong>
              Block {success.blockNumber}
            </strong>

            <strong>
              Room {success.roomNumber}
            </strong>
          </div>

        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="registration-error">
          {error}
        </div>
      )}

      <div className="registration-layout">

        {/* STUDENT SELECTION */}
        <div className="registration-panel student-selection-panel">

          <div className="registration-panel-header">
            <div>
              <span>STEP 1</span>

              <h4>Select student</h4>

              <p>
                Choose a student who is currently not
                registered.
              </p>
            </div>

            <div className="waiting-count">
              {students.length}
              <span>awaiting</span>
            </div>
          </div>

          <div className="registration-search">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search by name or class..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          {filteredStudents.length === 0 ? (
            <div className="registration-empty">
              <div className="registration-empty-icon">
                ✓
              </div>

              <h4>
                {students.length === 0
                  ? "Everyone is registered"
                  : "No students found"}
              </h4>

              <p>
                {students.length === 0
                  ? "There are no students currently awaiting registration."
                  : "Try another name or class."}
              </p>
            </div>
          ) : (
            <div className="registration-student-list">
              {filteredStudents.map((enrollment) => {
                const isSelected =
                  selectedStudent?.id === enrollment.id;

                return (
                  <button
                    type="button"
                    key={enrollment.id}
                    className={`registration-student ${
                      isSelected ? "selected" : ""
                    }`}
                    onClick={() =>
                      chooseStudent(enrollment)
                    }
                  >
                    <div className="registration-student-avatar">
                      {enrollment.students?.full_name
                        ?.charAt(0)
                        ?.toUpperCase() || "?"}
                    </div>

                    <div className="registration-student-info">
                      <strong>
                        {enrollment.students?.full_name ||
                          "Unknown student"}
                      </strong>

                      <span>
                        {enrollment.class_name}
                      </span>
                    </div>

                    <div className="registration-student-status">
                      NOT REGISTERED
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* REGISTRATION FORM */}
        <div className="registration-panel registration-form-panel">

          <div className="registration-panel-header">
            <div>
              <span>STEP 2</span>

              <h4>Reporting details</h4>

              <p>
                Complete the information provided by the
                student.
              </p>
            </div>
          </div>

          {!selectedStudent ? (
            <div className="no-student-selected">
              <div className="no-student-icon">
                1
              </div>

              <h4>Select a student</h4>

              <p>
                Choose a student from the list to open
                the registration form.
              </p>
            </div>
          ) : (
            <form
              className="registration-form"
              onSubmit={handleRegistration}
            >

              {/* SELECTED STUDENT */}
              <div className="selected-registration-student">
                <div className="selected-student-avatar">
                  {selectedStudent.students?.full_name
                    ?.charAt(0)
                    ?.toUpperCase() || "?"}
                </div>

                <div>
                  <span>SELECTED STUDENT</span>

                  <strong>
                    {selectedStudent.students?.full_name}
                  </strong>

                  <small>
                    {selectedStudent.class_name}
                  </small>
                </div>
              </div>

              {/* REPORTING DATE */}
              <div className="registration-field">
                <label htmlFor="reporting-date">
                  REPORTING DATE
                </label>

                <input
                  id="reporting-date"
                  type="date"
                  value={reportingDate}
                  onChange={(event) =>
                    setReportingDate(event.target.value)
                  }
                  required
                />
              </div>

              {/* PARENT PHONE */}
              <div className="registration-field">
                <label htmlFor="parent-phone">
                  PARENT / GUARDIAN PHONE NUMBER
                </label>

                <input
                  id="parent-phone"
                  type="tel"
                  placeholder="Enter parent or guardian number"
                  value={parentPhone}
                  onChange={(event) =>
                    setParentPhone(event.target.value)
                  }
                  autoComplete="tel"
                  required
                />
              </div>

              {/* NHIS */}
              <div className="registration-field">
                <label htmlFor="nhis-number">
                  NHIS MEMBERSHIP NUMBER
                </label>

                <input
                  id="nhis-number"
                  type="text"
                  placeholder="Enter NHIS membership number"
                  value={nhisNumber}
                  onChange={(event) =>
                    setNhisNumber(event.target.value)
                  }
                  autoComplete="off"
                  required
                />
              </div>

              {/* PAYMENT */}
              <div className="payment-confirmation">
                <div>
                  <span>HOUSE REGISTRATION FEE</span>

                  <strong>
                    GH₵
                    {Number(
                      academicYear?.registration_fee ?? 10
                    ).toFixed(2)}
                  </strong>
                </div>

                <div className="payment-status">
                  <i />
                  PAYMENT WILL BE RECORDED AS PAID
                </div>
              </div>

              {/* SUBMIT */}
              <button
                type="submit"
                className="complete-registration-button"
                disabled={registering}
              >
                {registering
                  ? "REGISTERING STUDENT..."
                  : "COMPLETE REGISTRATION"}
              </button>

              <button
                type="button"
                className="clear-registration-button"
                onClick={() => {
                  setSelectedStudent(null);
                  setParentPhone("");
                  setNhisNumber("");
                  setReportingDate(getToday());
                  setError("");
                  setSuccess(null);
                }}
                disabled={registering}
              >
                CANCEL
              </button>

            </form>
          )}

        </div>

      </div>

      {/* PROCESS INFORMATION */}
      <div className="registration-process">

        <div className="process-item">
          <div>1</div>
          <span>Select student</span>
        </div>

        <div className="process-line" />

        <div className="process-item">
          <div>2</div>
          <span>Enter details</span>
        </div>

        <div className="process-line" />

        <div className="process-item">
          <div>3</div>
          <span>GH₵10 payment</span>
        </div>

        <div className="process-line" />

        <div className="process-item">
          <div>4</div>
          <span>Room assigned automatically</span>
        </div>

      </div>

    </section>
  );
}

export default Registration;