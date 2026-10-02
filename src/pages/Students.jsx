import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function Students() {
  const [academicYear, setAcademicYear] = useState(null);
  const [students, setStudents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);

  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    setLoading(true);
    setError("");

    const { data: year, error: yearError } = await supabase
      .from("academic_years")
      .select("id, name, registration_fee")
      .eq("is_current", true)
      .single();

    if (yearError) {
      console.error("Academic year error:", yearError);

      setAcademicYear(null);
      setStudents([]);
      setError("No current academic year has been created yet.");
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
        created_at,
        students (
          id,
          full_name
        )
      `)
      .eq("academic_year_id", year.id)
      .order("created_at", { ascending: false });

    if (studentsError) {
      console.error("Students error:", studentsError);

      setStudents([]);
      setError("Unable to load students.");
      setLoading(false);
      return;
    }

    setStudents(data || []);
    setLoading(false);
  }

  async function handleAddStudent(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const cleanName = fullName.trim();
    const cleanClassName = className.trim();

    if (!cleanName) {
      setError("Please enter the student's full name.");
      return;
    }

    if (!cleanClassName) {
      setError("Please enter the student's class.");
      return;
    }

    if (!academicYear) {
      setError("No current academic year is available.");
      return;
    }

    setSaving(true);

    /*
      Check whether a student with the exact same name already exists.
      If one exists, we reuse the permanent student record.
      Otherwise, we create a new student.
    */
    const { data: existingStudent, error: existingStudentError } =
      await supabase
        .from("students")
        .select("id, full_name")
        .ilike("full_name", cleanName)
        .maybeSingle();

    if (existingStudentError) {
      console.error(
        "Existing student lookup error:",
        existingStudentError
      );

      setError("Unable to check the student record.");
      setSaving(false);
      return;
    }

    let student = existingStudent;

    if (!student) {
      const { data: newStudent, error: studentError } =
        await supabase
          .from("students")
          .insert({
            full_name: cleanName,
          })
          .select("id, full_name")
          .single();

      if (studentError) {
        console.error(
          "Student creation error:",
          studentError
        );

        setError("Unable to create the student record.");
        setSaving(false);
        return;
      }

      student = newStudent;
    }

    /*
      Make sure the student has not already been added
      to this academic year's roster.
    */
    const { data: existingEnrollment, error: enrollmentCheckError } =
      await supabase
        .from("student_enrollments")
        .select("id")
        .eq("student_id", student.id)
        .eq("academic_year_id", academicYear.id)
        .maybeSingle();

    if (enrollmentCheckError) {
      console.error(
        "Enrollment lookup error:",
        enrollmentCheckError
      );

      setError(
        "Unable to check whether this student is already on the roster."
      );

      setSaving(false);
      return;
    }

    if (existingEnrollment) {
      setError(
        `${student.full_name} is already on the ${academicYear.name} roster.`
      );

      setSaving(false);
      return;
    }

    const { error: enrollmentError } = await supabase
      .from("student_enrollments")
      .insert({
        student_id: student.id,
        academic_year_id: academicYear.id,
        class_name: cleanClassName,
        registration_status: "not_registered",
      });

    if (enrollmentError) {
      console.error(
        "Enrollment creation error:",
        enrollmentError
      );

      setError(
        "The student could not be added to the current roster."
      );

      setSaving(false);
      return;
    }

    setFullName("");
    setClassName("");
    setShowAddForm(false);

    setMessage(
      `${student.full_name} was added to the ${academicYear.name} roster.`
    );

    setSaving(false);

    await loadStudents();
  }

  const classOptions = useMemo(() => {
    const classes = students
      .map((student) => student.class_name?.trim())
      .filter(Boolean);

    return [...new Set(classes)].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [students]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return students.filter((enrollment) => {
      const studentName =
        enrollment.students?.full_name?.toLowerCase() || "";

      const studentClass =
        enrollment.class_name?.toLowerCase() || "";

      const matchesSearch =
        !normalizedSearch ||
        studentName.includes(normalizedSearch) ||
        studentClass.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        enrollment.registration_status === statusFilter;

      const matchesClass =
        classFilter === "all" ||
        enrollment.class_name === classFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesClass
      );
    });
  }, [students, search, statusFilter, classFilter]);

  const registeredCount = students.filter(
    (student) =>
      student.registration_status === "registered"
  ).length;

  const notRegisteredCount = students.filter(
    (student) =>
      student.registration_status === "not_registered"
  ).length;

  return (
    <section className="students-page">
      {/* PAGE HEADER */}
      <div className="section-hero">
        <div className="section-hero-icon">◫</div>

        <div>
          <span>STUDENT MANAGEMENT</span>

          <h3>Students</h3>

          <p>
            Build and manage the Gbewah House student roster
            for the current academic year.
          </p>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="student-summary-grid">
        <div className="student-summary-card">
          <span>TOTAL STUDENTS</span>

          <strong>{students.length}</strong>

          <p>Current academic year</p>
        </div>

        <div className="student-summary-card">
          <span>REGISTERED</span>

          <strong>{registeredCount}</strong>

          <p>Completed registration</p>
        </div>

        <div className="student-summary-card">
          <span>NOT REGISTERED</span>

          <strong>{notRegisteredCount}</strong>

          <p>Awaiting reporting</p>
        </div>

        <div className="student-summary-card">
          <span>ACADEMIC YEAR</span>

          <strong>
            {academicYear?.name || "—"}
          </strong>

          <p>Current roster</p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="students-toolbar">
        <div className="students-search">
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

        <select
          value={classFilter}
          onChange={(event) =>
            setClassFilter(event.target.value)
          }
        >
          <option value="all">All Classes</option>

          {classOptions.map((classItem) => (
            <option
              key={classItem}
              value={classItem}
            >
              {classItem}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
        >
          <option value="all">All Status</option>

          <option value="registered">
            Registered
          </option>

          <option value="not_registered">
            Not Registered
          </option>
        </select>

        <button
          type="button"
          className="add-student-button"
          onClick={() => {
            setShowAddForm((value) => !value);
            setMessage("");
            setError("");
          }}
        >
          <span>+</span>
          ADD STUDENT
        </button>
      </div>

      {/* ADD STUDENT FORM */}
      {showAddForm && (
        <form
          className="add-student-form"
          onSubmit={handleAddStudent}
        >
          <div className="form-header">
            <div>
              <span>NEW ROSTER ENTRY</span>

              <h4>Add Student</h4>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setMessage("");
                setError("");
              }}
            >
              CLOSE
            </button>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="full-name">
                FULL NAME
              </label>

              <input
                id="full-name"
                type="text"
                placeholder="Enter student's full name"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                autoComplete="off"
              />
            </div>

            <div className="form-field">
              <label htmlFor="class-name">
                CLASS
              </label>

              <input
                id="class-name"
                type="text"
                placeholder="e.g. GA2A, SC1A, ICT2B"
                value={className}
                onChange={(event) =>
                  setClassName(event.target.value)
                }
                autoComplete="off"
              />
            </div>
          </div>

          <div className="form-note">
            The class should be entered exactly as the school
            uses it. For example: <strong>GA1A</strong>,{" "}
            <strong>GA2A</strong>, <strong>SC2B</strong>,
            or any other class code.
            <br />
            New students are automatically added as{" "}
            <strong>NOT REGISTERED</strong>.
          </div>

          <button
            type="submit"
            className="save-student-button"
            disabled={saving}
          >
            {saving
              ? "ADDING STUDENT..."
              : "ADD TO ROSTER"}
          </button>
        </form>
      )}

      {/* MESSAGES */}
      {message && (
        <div className="student-success">
          ✓ {message}
        </div>
      )}

      {error && (
        <div className="student-error">
          {error}
        </div>
      )}

      {/* STUDENT TABLE */}
      <div className="students-table-card">
        <div className="table-heading">
          <div>
            <span>CURRENT ROSTER</span>

            <h4>
              {academicYear?.name || "Academic Year"}
            </h4>
          </div>

          <strong>
            {filteredStudents.length} student
            {filteredStudents.length !== 1 ? "s" : ""}
          </strong>
        </div>

        {loading ? (
          <div className="students-empty">
            <div className="table-spinner" />

            <p>Loading students...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="students-empty">
            <div className="empty-symbol">
              ◫
            </div>

            <h4>
              {students.length === 0
                ? "No students on the roster yet"
                : "No students found"}
            </h4>

            <p>
              {students.length === 0
                ? "Add students to the current Gbewah House roster to see them here."
                : "Try changing your search or filters."}
            </p>
          </div>
        ) : (
          <div className="students-table-wrapper">
            <table className="students-table">
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>CLASS</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>
                      <div className="student-name-cell">
                        <div className="student-avatar">
                          {enrollment.students?.full_name
                            ?.charAt(0)
                            ?.toUpperCase() || "?"}
                        </div>

                        <strong>
                          {enrollment.students?.full_name ||
                            "Unknown student"}
                        </strong>
                      </div>
                    </td>

                    <td>
                      <span className="class-badge">
                        {enrollment.class_name}
                      </span>
                    </td>

                    <td>
                      {enrollment.registration_status ===
                      "registered" ? (
                        <span className="status-badge registered">
                          <i />
                          REGISTERED
                        </span>
                      ) : (
                        <span className="status-badge not-registered">
                          <i />
                          NOT REGISTERED
                        </span>
                      )}
                    </td>
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

export default Students;