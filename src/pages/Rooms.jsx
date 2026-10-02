import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./Rooms.css";

function Rooms() {
  const [academicYear, setAcademicYear] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRoomData();
  }, []);

  async function loadRoomData() {
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

    const [{ data: roomData, error: roomsError }, { data: registrationData, error: registrationsError }] =
      await Promise.all([
        supabase
          .from("rooms")
          .select("id, block_number, room_number, allocation_order, capacity")
          .eq("is_active", true)
          .order("allocation_order", { ascending: true }),
        supabase
          .from("registrations")
          .select(`
            id,
            room_id,
            reporting_date,
            registered_at,
            student_enrollments!inner (
              id,
              academic_year_id,
              class_name,
              students (
                id,
                full_name
              )
            )
          `)
          .eq("student_enrollments.academic_year_id", year.id)
          .order("registered_at", { ascending: false }),
      ]);

    if (roomsError) {
      console.error("Rooms error:", roomsError);
      setError("Unable to load room information.");
      setLoading(false);
      return;
    }

    if (registrationsError) {
      console.error("Registrations error:", registrationsError);
      setError("Unable to load room assignments.");
      setLoading(false);
      return;
    }

    setRooms(roomData || []);
    setRegistrations(registrationData || []);

    if (roomData?.length > 0) {
      setSelectedRoomId((current) => current || roomData[0].id);
    } else {
      setSelectedRoomId(null);
    }

    setLoading(false);
  }

  const roomData = useMemo(() => {
    return rooms.map((room) => {
      const occupants = registrations
        .filter((registration) => registration.room_id === room.id)
        .map((registration) => {
          const enrollment = Array.isArray(registration.student_enrollments)
            ? registration.student_enrollments[0]
            : registration.student_enrollments;

          return {
            registrationId: registration.id,
            studentId: enrollment?.students?.id || null,
            name: enrollment?.students?.full_name || "Unknown student",
            className: enrollment?.class_name || "—",
            reportingDate: registration.reporting_date,
            registeredAt: registration.registered_at,
          };
        });

      const occupied = occupants.length;
      const capacity = Number(room.capacity || 0);
      const available = Math.max(capacity - occupied, 0);
      const percentage = capacity > 0 ? Math.min((occupied / capacity) * 100, 100) : 0;

      let status = "AVAILABLE";
      if (occupied >= capacity && capacity > 0) {
        status = "FULL";
      } else if (percentage >= 80) {
        status = "ALMOST FULL";
      }

      return {
        ...room,
        blockLabel: `Block ${room.block_number}`,
        roomLabel: `Room ${room.room_number}`,
        occupied,
        capacity,
        available,
        percentage,
        status,
        occupants,
      };
    });
  }, [rooms, registrations]);

  const selectedRoom = roomData.find((room) => room.id === selectedRoomId) || null;

  function handleViewRoom(roomId) {
    setSelectedRoomId(roomId);

    requestAnimationFrame(() => {
      document
        .getElementById("room-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const totalCapacity = roomData.reduce((sum, room) => sum + room.capacity, 0);
  const totalOccupied = roomData.reduce((sum, room) => sum + room.occupied, 0);
  const totalAvailable = Math.max(totalCapacity - totalOccupied, 0);
  const fullRooms = roomData.filter((room) => room.status === "FULL").length;
  const utilization = totalCapacity > 0 ? (totalOccupied / totalCapacity) * 100 : 0;

  function formatDate(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function formatDateTime(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  return (
    <section className="rooms-page">
      <div className="rooms-page-header">
        <div>
          <span className="rooms-eyebrow">ACCOMMODATION MANAGEMENT</span>
          <h2>Room Management</h2>
          <p>
            Monitor Gbewah House room occupancy, available spaces and assigned
            students for the current academic year.
          </p>
        </div>

        <div className="rooms-year-badge">
          <span>ACADEMIC YEAR</span>
          <strong>{academicYear?.name || "—"}</strong>
        </div>
      </div>

      {error && (
        <div className="rooms-alert" role="alert">
          <strong>Room data unavailable</strong>
          <span>{error}</span>
          <button type="button" onClick={loadRoomData}>
            Retry
          </button>
        </div>
      )}

      <div className="rooms-summary-grid">
        <div className="rooms-summary-card">
          <div className="rooms-summary-label">TOTAL ROOMS</div>
          <strong>{loading ? "..." : roomData.length}</strong>
          <span>Active accommodation rooms</span>
        </div>

        <div className="rooms-summary-card">
          <div className="rooms-summary-label">TOTAL CAPACITY</div>
          <strong>{loading ? "..." : totalCapacity}</strong>
          <span>Maximum student spaces</span>
        </div>

        <div className="rooms-summary-card">
          <div className="rooms-summary-label">OCCUPIED</div>
          <strong>{loading ? "..." : totalOccupied}</strong>
          <span>Students currently assigned</span>
        </div>

        <div className="rooms-summary-card">
          <div className="rooms-summary-label">AVAILABLE SPACES</div>
          <strong>{loading ? "..." : totalAvailable}</strong>
          <span>{fullRooms} room{fullRooms === 1 ? "" : "s"} currently full</span>
        </div>
      </div>

      <div className="rooms-utilization-card">
        <div>
          <span className="rooms-card-eyebrow">HOUSE OCCUPANCY</span>
          <h3>Overall room utilization</h3>
          <p>
            {loading
              ? "Loading accommodation figures..."
              : `${totalOccupied} of ${totalCapacity} available spaces are occupied.`}
          </p>
        </div>

        <div className="rooms-utilization-value">
          <strong>{loading ? "..." : `${Math.round(utilization)}%`}</strong>
          <span>utilized</span>
        </div>
      </div>

      <div className="rooms-section-heading">
        <div>
          <span className="rooms-card-eyebrow">ROOMS</span>
          <h3>Accommodation overview</h3>
        </div>
        <span className="rooms-section-note">6 rooms • 50 students per room</span>
      </div>

      {loading ? (
        <div className="rooms-empty-state">Loading room information...</div>
      ) : roomData.length === 0 ? (
        <div className="rooms-empty-state">No active rooms are available.</div>
      ) : (
        <div className="rooms-card-grid">
          {roomData.map((room) => (
            <article
              key={room.id}
              className={`room-management-card ${
                selectedRoomId === room.id ? "selected" : ""
              }`}
            >
              <div className="room-management-top">
                <div>
                  <span>{room.blockLabel}</span>
                  <h3>{room.roomLabel}</h3>
                </div>

                <span
                  className={`room-status room-status-${room.status
                    .toLowerCase()
                    .replace(" ", "-")}`}
                >
                  {room.status}
                </span>
              </div>

              <div className="room-management-progress">
                <div className="room-management-progress-track">
                  <div
                    className="room-management-progress-fill"
                    style={{ width: `${room.percentage}%` }}
                  />
                </div>
                <strong>{Math.round(room.percentage)}%</strong>
              </div>

              <div className="room-management-numbers">
                <div>
                  <span>OCCUPIED</span>
                  <strong>{room.occupied}</strong>
                </div>
                <div>
                  <span>AVAILABLE</span>
                  <strong>{room.available}</strong>
                </div>
                <div>
                  <span>CAPACITY</span>
                  <strong>{room.capacity}</strong>
                </div>
              </div>

              <div className="room-management-footer">
                <span>
                  {room.occupied} student{room.occupied === 1 ? "" : "s"} assigned
                </span>

                <button
                  type="button"
                  className="room-view-button"
                  onClick={() => handleViewRoom(room.id)}
                >
                  VIEW <span aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedRoom && (
        <section id="room-details" className="room-detail-panel">
          <div className="room-detail-header">
            <div>
              <span className="rooms-card-eyebrow">ROOM DETAILS</span>
              <h3>
                {selectedRoom.blockLabel} • {selectedRoom.roomLabel}
              </h3>
              <p>
                {selectedRoom.occupied} of {selectedRoom.capacity} spaces occupied
              </p>
            </div>

            <span
              className={`room-status room-status-${selectedRoom.status
                .toLowerCase()
                .replace(" ", "-")}`}
            >
              {selectedRoom.status}
            </span>
          </div>

          {selectedRoom.occupants.length === 0 ? (
            <div className="room-detail-empty">
              No students have been assigned to this room yet.
            </div>
          ) : (
            <div className="room-students-table-wrap">
              <table className="room-students-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>STUDENT</th>
                    <th>CLASS</th>
                    <th>REPORTING DATE</th>
                    <th>REGISTERED AT</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRoom.occupants.map((student, index) => (
                    <tr key={student.registrationId}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{student.name}</strong>
                      </td>
                      <td>{student.className}</td>
                      <td>{formatDate(student.reportingDate)}</td>
                      <td>{formatDateTime(student.registeredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </section>
  );
}

export default Rooms;
