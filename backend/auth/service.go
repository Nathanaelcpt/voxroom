package auth

import (
	"context"
	"errors"

	"voxroom/backend/db"

	"golang.org/x/crypto/bcrypt"
)

func Register(username, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = db.Pool.Exec(
		context.Background(),
		"INSERT INTO users (username, password_hash) VALUES ($1, $2)",
		username,
		string(hash),
	)
	return err
}

func Login(username, password string) (string, error) {
	var userID string
	var passwordHash string

	err := db.Pool.QueryRow(
		context.Background(),
		"SELECT id, password_hash FROM users WHERE username=$1",
		username,
	).Scan(&userID, &passwordHash)

	if err != nil {
		return "", errors.New("invalid credentials")
	}

	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password))
	if err != nil {
		return "", errors.New("invalid credentials")
	}

	return GenerateToken(userID)
}
