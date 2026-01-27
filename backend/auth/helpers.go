package auth

import "context"

func MustUserID(ctx context.Context) string {
	userID, ok := ctx.Value(UserIDKey).(string)
	if !ok || userID == "" {
		panic("user id not found in context")
	}
	return userID
}
