package room

import (
	"context"
	"encoding/json"
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

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second) // 🆕 Increase timeout
	defer cancel()

	var roomID string

	// 🆕 Use ExecuteWithRetry for database operations
	err := db.ExecuteWithRetry(ctx, 3, func(ctx context.Context) error {
		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		// 1️⃣ create room
		err = tx.QueryRow(ctx, `
			INSERT INTO rooms (title, host_id, is_live)
			VALUES ($1, $2, true)
			RETURNING id
		`, req.Title, userID).Scan(&roomID)

		if err != nil {
			return err
		}

		// 2️⃣ host auto join
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
		// 🆕 Better error handling
		if ctx.Err() == context.DeadlineExceeded {
			http.Error(w, "request timeout", http.StatusRequestTimeout)
		} else if db.IsConnectionError(err) {
			http.Error(w, "database temporarily unavailable", http.StatusServiceUnavailable)
		} else {
			http.Error(w, "failed to create room", http.StatusInternalServerError)
		}
		return
	}

	res := CreateRoomResponse{
		RoomID: roomID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}