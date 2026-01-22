package room

import (
	"context"
	"time"

	"voxroom/internal/db"
)

func SaveEvent(roomID, userID, eventType string) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`INSERT INTO room_events (room_id, user_id, event_type, created_at)
		 VALUES ($1, $2, $3, $4)`,
		roomID,
		userID,
		eventType,
		time.Now(),
	)
	return err
}
