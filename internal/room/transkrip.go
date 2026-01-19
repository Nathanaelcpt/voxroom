package room

import (
	"context"
	"time"

	"voxroom/internal/db"
)

func SaveTranscript(roomID, userID, text string) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`INSERT INTO transcripts (room_id, user_id, text, created_at)
		 VALUES ($1, $2, $3, $4)`,
		roomID, userID, text, time.Now(),
	)
	return err
}

