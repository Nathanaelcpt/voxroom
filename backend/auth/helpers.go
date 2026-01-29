package auth

import (
	"context"
	"fmt"
)

// MustUserID extracts user ID from context or panics
// Use this only in handlers where auth is guaranteed (after AuthMiddleware)
func MustUserID(ctx context.Context) string {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		panic("user id not found in context - ensure AuthMiddleware is applied")
	}
	return userID
}

// GetUserID safely extracts user ID from context
// Returns empty string if not found (no panic)
func GetUserID(ctx context.Context) string {
	userID, _ := ctx.Value(UserIDKey).(string)
	return userID
}

// RequireUserID extracts user ID from context or returns error
// Safer alternative to MustUserID for error handling
func RequireUserID(ctx context.Context) (string, error) {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		return "", fmt.Errorf("user id not found in context")
	}
	return userID, nil
}