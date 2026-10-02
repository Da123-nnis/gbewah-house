import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function DeleteRecords() {
  const [academicYear, setAcademicYear] = useState(null);
  const [records, setRecords] = useState([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    setError("");
    setMessage("");

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
        created_at,
        students (
          id,
          full_name
        ),
        registrations (
          id,
          reporting_date,
          room_id,
          registered_at
        )
      `)
      .eq("academic_year_id", year.id)
      .order("created_at", { ascending: false });

    if (recordsError) {
      console.error("Records error:", recordsError);
      setError("Unable to load student records.");
      setLoading(false);
      return;
    }

    setRecords(data || []);
    setLoading(false);
  }

  async function deleteRegistration(registrationId, studentName) {
    const confirmed = window.confirm(
      `Delete the registration for ${studentName}?\n\nThis will remove the registration and GH₵10 payment record and return the student to NOT REGISTERED.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(registrationId);
    setError("");
    setMessage("");

    const { data, error: deleteError } = await supabase.rpc(
      "delete_registration",
      {
        p_registration_id: registrationId,
      }
    );

    if (deleteError) {
      console.error(
        "Delete registration error:",
        deleteError
      );

      setError(
        deleteError.message ||
          "Unable to delete the registration."
      );

      setDeletingId(null);
      return;
    }

    setMessage(
      data?.message ||
        `${studentName}'s registration was deleted.`
    );

    setDeletingId(null);

    await loadRecords();
  }

  async function removeStudent(enrollmentId, studentName) {
    const confirmed = window.confirm(
      `Remove ${studentName} from the ${academicYear?.name || "current"} roster?\n\nThis should only be used for mistakes or test records.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(enrollmentId);
    setError("");
    setMessage("");

    const { data, error: deleteError } = await supabase.rpc(
      "remove_student_from_roster",
      {
        p_enrollment_id: enrollmentId,
      }
    );

    if (deleteError) {
      console.error(
        "Remove student error:",
        deleteError
      );

      setError(
        deleteError.message ||
          "Unable to remove the student."
      );

      setDeletingId(null);
      return;
    }

    setMessage(
      data?.message ||
        `${studentName} was removed from the roster.`
    );

    setDeletingId(null);

    await loadRecords();
  }

  const filteredRecords = records.filter((record) => {
    const name =
      record.students?.full_name?.toLowerCase() || "";

    const className =
      record.class_name?.toLowerCase() || "";

    const query = search.trim().toLowerCase();

    return (
      !query ||
      name.includes(query) ||
      className.includes(query)
    );
  });

  return (
    <section className="delete-records-page">

      <div className="section-hero">
        <div className="section-hero-icon">
          ×
        </div>

        <div>
          <span>RECORD MANAGEMENT</span>

          <h3>Delete Records</h3>

          <p>
            Correct registration mistakes and remove
            test records from the current roster.
          </p>
        </div>
      </div>

      <div className="delete-warning">
        <div className="delete-warning-icon">
          !
        </div>

        <div>
          <strong>Use this section carefully</strong>

          <p>
            Deleting a registration removes its payment
            record and returns the student to NOT REGISTERED.
            A student can then be removed from the roster
            when necessary.
          </p>
        </div>
      </div>

      {message && (
        <div className="delete-success">
          ✓ {message}
        </div>
      )}

      {error && (
        <div className="delete-error">
          {error}
        </div>
      )}

      <div className="delete-toolbar">
        <div className="delete-search">
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

        <div className="delete-year">
          <span>ACADEMIC YEAR</span>

          <strong>
            {academicYear?.name || "—"}
          </strong>
        </div>
      </div>

      <div className="delete-records-card">

        <div className="delete-records-heading">
          <div>
            <span>CURRENT RECORDS</span>

            <h4>
              Registration management
            </h4>
          </div>

          <strong>
            {filteredRecords.length} record
            {filteredRecords.length !== 1 ? "s" : ""}
          </strong>
        </div>

        {loading ? (
          <div className="delete-empty">
            <div className="table-spinner" />

            <p>
              Loading records...
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="delete-empty">
            <div className="delete-empty-icon">
              ✓
            </div>

            <h4>
              No records found
            </h4>

            <p>
              There are no current-year records matching
              your search.
            </p>
          </div>
        ) : (
          <div className="delete-table-wrapper">

            <table className="delete-table">

              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>CLASS</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => {
                  const studentName =
                    record.students?.full_name ||
                    "Unknown student";

                  const registration =
                    Array.isArray(
                      record.registrations
                    )
                      ? record.registrations[0]
                      : record.registrations;

                  const isRegistered =
                    record.registration_status ===
                    "registered";

                  const actionId = isRegistered
                    ? registration?.id
                    : record.id;

                  const isDeleting =
                    deletingId === actionId;

                  return (
                    <tr key={record.id}>

                      <td>
                        <div className="delete-student-cell">

                          <div className="delete-avatar">
                            {studentName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {studentName}
                            </strong>

                            {registration && (
                              <span>
                                Registered{" "}
                                {registration.reporting_date}
                              </span>
                            )}
                          </div>

                        </div>
                      </td>

                      <td>
                        <span className="delete-class-badge">
                          {record.class_name}
                        </span>
                      </td>

                      <td>
                        {isRegistered ? (
                          <span className="delete-status registered">
                            <i />
                            REGISTERED
                          </span>
                        ) : (
                          <span className="delete-status not-registered">
                            <i />
                            NOT REGISTERED
                          </span>
                        )}
                      </td>

                      <td>
                        {isRegistered ? (
                          <button
                            type="button"
                            className="delete-action-button registration-delete"
                            onClick={() =>
                              deleteRegistration(
                                registration?.id,
                                studentName
                              )
                            }
                            disabled={
                              isDeleting ||
                              !registration?.id
                            }
                          >
                            {isDeleting
                              ? "DELETING..."
                              : "DELETE REGISTRATION"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="delete-action-button roster-delete"
                            onClick={() =>
                              removeStudent(
                                record.id,
                                studentName
                              )
                            }
                            disabled={isDeleting}
                          >
                            {isDeleting
                              ? "REMOVING..."
                              : "REMOVE FROM ROSTER"}
                          </button>
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

    </section>
  );
}

export default DeleteRecords;