package room

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"
)

type CreateRoomRequest struct {
	Title string `json:"title"`
}

type CreateRoomResponse struct {
	RoomID string `json:"room_id"`
}

type Room struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	HostID      string    `json:"host_id"`
	HostName    string    `json:"host_name"`
	IsLive      bool      `json:"is_live"`
	CreatedAt   time.Time `json:"created_at"`
	Listeners   int       `json:"listeners"`
}

type RoomDetail struct {
	Room
	Participants []Participant `json:"participants"`
}

type Participant struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

// CREATE ROOM
func CreateRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	log.Printf("📝 Creating room: %s by user: %s", req.Title, userID)

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var roomID string

	err := db.ExecuteWithRetry(ctx, 3, func(ctx context.Context) error {
		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		err = tx.QueryRow(ctx, `
			INSERT INTO rooms (title, host_id, is_live)
			VALUES ($1, $2, true)
			RETURNING id
		`, req.Title, userID).Scan(&roomID)

		if err != nil {
			return err
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO room_participants (room_id, user_id, role)
			VALUES ($1, $2, 'host')
		`, roomID, userID)

		if err != nil {
			return err
		}

		return tx.Commit(ctx)
	})

	if err != nil {
		log.Printf("❌ Failed to create room: %v", err)
		if ctx.Err() == context.DeadlineExceeded {
			http.Error(w, "request timeout", http.StatusRequestTimeout)
		} else if db.IsConnectionError(err) {
			http.Error(w, "database temporarily unavailable", http.StatusServiceUnavailable)
		} else {
			http.Error(w, "failed to create room", http.StatusInternalServerError)
		}
		return
	}

	log.Printf("✅ Room created: %s", roomID)

	res := CreateRoomResponse{
		RoomID: roomID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// 🆕 GET ACTIVE ROOMS
func GetActiveRooms(w http.ResponseWriter, r *http.Request) {
	log.Println("📋 Fetching active rooms")

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	rows, err := db.Pool.Query(ctx, `
		SELECT 
			r.id, 
			r.title, 
			r.host_id,
			COALESCE(u.display_name, u.username, 'Unknown') as host_name,
			r.created_at,
			r.is_live,
			COALESCE(COUNT(rp.user_id), 0) as listeners
		FROM rooms r
		LEFT JOIN auth.users u ON r.host_id = u.id
		LEFT JOIN room_participants rp ON r.id = rp.room_id
		WHERE r.is_live = true
		GROUP BY r.id, r.title, r.host_id, u.display_name, u.username, r.created_at, r.is_live
		ORDER BY r.created_at DESC
		LIMIT 50
	`)

	if err != nil {
		log.Printf("❌ Query error: %v", err)
		http.Error(w, "failed to fetch rooms", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rooms []Room
	for rows.Next() {
		var room Room
		err := rows.Scan(
			&room.ID,
			&room.Title,
			&room.HostID,
			&room.HostName,
			&room.CreatedAt,
			&room.IsLive,
			&room.Listeners,
		)
		if err != nil {
			log.Printf("⚠️ Scan error: %v", err)
			continue
		}
		rooms = append(rooms, room)
	}

	if rooms == nil {
		rooms = []Room{}
	}

	log.Printf("✅ Found %d active rooms", len(rooms))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rooms)
}

// 🆕 GET ROOM DETAILS
func GetRoomDetails(w http.ResponseWriter, r *http.Request) {
	// Extract roomId dari path
	roomID := r.PathValue("roomId")
	if roomID == "" {
		http.Error(w, "room id required", http.StatusBadRequest)
		return
	}

	log.Printf("🔍 Fetching room details: %s", roomID)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Get room info
	var room Room
	err := db.Pool.QueryRow(ctx, `
		SELECT 
			r.id, 
			r.title, 
			r.host_id, 
			COALESCE(u.display_name, u.username, 'Unknown') as host_name,
			r.created_at, 
			r.is_live
		FROM rooms r
		LEFT JOIN auth.users u ON r.host_id = u.id
		WHERE r.id = $1
	`, roomID).Scan(
		&room.ID,
		&room.Title,
		&room.HostID,
		&room.HostName,
		&room.CreatedAt,
		&room.IsLive,
	)

	if err != nil {
		log.Printf("❌ Room not found: %v", err)
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}

	// Get participants
	rows, err := db.Pool.Query(ctx, `
		SELECT 
			rp.user_id, 
			COALESCE(u.display_name, u.username, 'Unknown') as username,
			rp.role
		FROM room_participants rp
		LEFT JOIN auth.users u ON rp.user_id = u.id
		WHERE rp.room_id = $1
	`, roomID)

	if err != nil {
		log.Printf("⚠️ Failed to get participants: %v", err)
		// Continue without participants
	} else {
		defer rows.Close()

		var participants []Participant
		for rows.Next() {
			var p Participant
			err := rows.Scan(&p.UserID, &p.Username, &p.Role)
			if err != nil {
				continue
			}
			participants = append(participants, p)
		}

		room.Listeners = len(participants)

		detail := RoomDetail{
			Room:         room,
			Participants: participants,
		}

		log.Printf("✅ Room details: %s (%d participants)", room.Title, len(participants))

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
		return
	}

	// Fallback without participants
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(RoomDetail{
		Room:         room,
		Participants: []Participant{},
	})
}

// 🆕 JOIN ROOM
func JoinRoom(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(auth.UserIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	roomID := r.PathValue("roomId")
	if roomID == "" {
		http.Error(w, "room id required", http.StatusBadRequest)
		return
	}

	log.Printf("👋 User %s joining room %s", userID, roomID)

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Check if room exists and is live
	var isLive bool
	err := db.Pool.QueryRow(ctx, `
		SELECT is_live FROM rooms WHERE id = $1
	`, roomID).Scan(&isLive)

	if err != nil {
		log.Printf("❌ Room not found: %v", err)
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}

	if !isLive {
		http.Error(w, "room is not live", http.StatusForbidden)
		return
	}

	// Add user as listener
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO room_participants (room_id, user_id, role)
		VALUES ($1, $2, 'listener')
		ON CONFLICT (room_id, user_id) DO NOTHING
	`, roomID, userID)

	if err != nil {
		log.Printf("❌ Failed to join room: %v", err)
		http.Error(w, "failed to join room", http.StatusInternalServerError)
		return
	}

	log.Printf("✅ User %s joined room %s", userID, roomID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "joined",
		"room_id": roomID,
	})
}