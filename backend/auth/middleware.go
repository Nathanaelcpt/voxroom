package auth

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v4"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("🔐 AuthMiddleware: %s %s", r.Method, r.URL.Path)

		// ✅ allow CORS preflight
		if r.Method == http.MethodOptions {
			log.Println("✅ OPTIONS preflight - passing through")
			w.WriteHeader(http.StatusOK)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			log.Println("❌ No Authorization header")
			http.Error(w, "missing authorization", http.StatusUnauthorized)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			log.Println("❌ Invalid Authorization format")
			http.Error(w, "invalid authorization format", http.StatusUnauthorized)
			return
		}

		tokenStr := parts[1]
		log.Printf("🎫 Token received: %s...", tokenStr[:min(20, len(tokenStr))])

		// Get JWT secret from env
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			log.Println("❌ JWT_SECRET not configured")
			http.Error(w, "auth service misconfigured", http.StatusInternalServerError)
			return
		}

		// Parse token
		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil {
			log.Printf("❌ Token parse error: %v", err)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		if !token.Valid {
			log.Println("❌ Token is not valid")
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Println("❌ Invalid claims format")
			http.Error(w, "invalid claims", http.StatusUnauthorized)
			return
		}

		userID, ok := claims["sub"].(string)
		if !ok || userID == "" {
			log.Println("❌ No user ID in claims")
			http.Error(w, "invalid user id", http.StatusUnauthorized)
			return
		}

		log.Printf("✅ Auth successful - User ID: %s", userID)

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}