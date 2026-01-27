package auth

import (
	"context"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/MicahParks/keyfunc"
	"github.com/golang-jwt/jwt/v4"
)

type contextKey string

const UserIDKey contextKey = "user_id"

const jwksURL = "https://ecvtonwwjwjixwfhjtdh.supabase.co/auth/v1/keys"

var (
	jwks     *keyfunc.JWKS
	jwksOnce sync.Once
	jwksErr  error
)

func loadJWKS() error {
	jwksOnce.Do(func() {
		jwks, jwksErr = keyfunc.Get(jwksURL, keyfunc.Options{
			RefreshInterval: time.Hour,
			RefreshErrorHandler: func(err error) {
				log.Println("⚠️ JWKS refresh error:", err.Error())
			},
		})
	})
	return jwksErr
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("🔐 AuthMiddleware: %s %s", r.Method, r.URL.Path)

		// ✅ allow CORS preflight
		if r.Method == http.MethodOptions {
			log.Println("✅ OPTIONS preflight - passing through")
			w.WriteHeader(http.StatusOK)
			return
		}

		// ✅ lazy load JWKS (aman di Render)
		if err := loadJWKS(); err != nil {
			log.Printf("❌ JWKS load error: %v", err)
			http.Error(w, "auth service unavailable", http.StatusServiceUnavailable)
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

		token, err := jwt.Parse(tokenStr, jwks.Keyfunc)
		if err != nil || !token.Valid {
			log.Printf("❌ Token validation failed: %v", err)
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

// 🆕 RequireAuth wraps http.HandlerFunc dengan auth check
func RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("🔐 RequireAuth: %s %s", r.Method, r.URL.Path)

		// ✅ lazy load JWKS
		if err := loadJWKS(); err != nil {
			log.Printf("❌ JWKS load error: %v", err)
			http.Error(w, "auth service unavailable", http.StatusServiceUnavailable)
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
		log.Printf("🎫 Token: %s...", tokenStr[:min(20, len(tokenStr))])

		token, err := jwt.Parse(tokenStr, jwks.Keyfunc)
		if err != nil || !token.Valid {
			log.Printf("❌ Token validation failed: %v", err)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Println("❌ Invalid claims")
			http.Error(w, "invalid claims", http.StatusUnauthorized)
			return
		}

		userID, ok := claims["sub"].(string)
		if !ok || userID == "" {
			log.Println("❌ No user ID")
			http.Error(w, "invalid user id", http.StatusUnauthorized)
			return
		}

		log.Printf("✅ Auth OK - User: %s", userID)

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// 🆕 Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}