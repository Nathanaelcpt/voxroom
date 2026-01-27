package auth

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
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
	jwksMu   sync.RWMutex
)

func loadJWKS() error {
	jwksMu.RLock()
	if jwks != nil && jwksErr == nil {
		jwksMu.RUnlock()
		return nil
	}
	jwksMu.RUnlock()

	jwksMu.Lock()
	defer jwksMu.Unlock()

	if jwks != nil && jwksErr == nil {
		return nil
	}

	log.Printf("🔑 Loading JWKS from %s", jwksURL)

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	var lastErr error
	for i := 0; i < 3; i++ {
		options := keyfunc.Options{
			Client:          client,
			RefreshInterval: time.Hour,
			RefreshErrorHandler: func(err error) {
				log.Printf("⚠️ JWKS refresh error: %v", err)
			},
		}

		jwks, lastErr = keyfunc.Get(jwksURL, options)
		if lastErr == nil {
			log.Println("✅ JWKS loaded successfully")
			jwksErr = nil
			return nil
		}

		log.Printf("⚠️ JWKS load attempt %d/3 failed: %v", i+1, lastErr)
		
		if i < 2 {
			time.Sleep(time.Duration(i+1) * time.Second)
		}
	}

	jwksErr = fmt.Errorf("failed to load JWKS after 3 attempts: %w", lastErr)
	log.Printf("❌ %v", jwksErr)
	return jwksErr
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("🔐 AuthMiddleware: %s %s", r.Method, r.URL.Path)

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

		// Try JWKS first (modern way)
		token, err := validateWithJWKS(tokenStr)
		if err == nil && token.Valid {
			userID, err := extractUserID(token)
			if err != nil {
				log.Printf("❌ Extract user ID error: %v", err)
				http.Error(w, "invalid token claims", http.StatusUnauthorized)
				return
			}

			log.Printf("✅ Auth successful (JWKS) - User ID: %s", userID)
			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Fallback to JWT Secret (legacy way)
		log.Printf("⚠️ JWKS validation failed: %v, trying JWT Secret fallback", err)
		token, err = validateWithSecret(tokenStr)
		if err != nil {
			log.Printf("❌ JWT Secret validation also failed: %v", err)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		if !token.Valid {
			log.Println("❌ Token is not valid")
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		userID, err := extractUserID(token)
		if err != nil {
			log.Printf("❌ Extract user ID error: %v", err)
			http.Error(w, "invalid token claims", http.StatusUnauthorized)
			return
		}

		log.Printf("✅ Auth successful (Secret) - User ID: %s", userID)
		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Validate token using JWKS (supports ES256)
func validateWithJWKS(tokenStr string) (*jwt.Token, error) {
	if err := loadJWKS(); err != nil {
		return nil, fmt.Errorf("JWKS not available: %w", err)
	}

	token, err := jwt.Parse(tokenStr, jwks.Keyfunc)
	if err != nil {
		return nil, err
	}

	return token, nil
}

// Validate token using JWT Secret (HS256 only)
func validateWithSecret(tokenStr string) (*jwt.Token, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET not configured")
	}

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	return token, err
}

// Extract user ID from token claims
func extractUserID(token *jwt.Token) (string, error) {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid claims format")
	}

	userID, ok := claims["sub"].(string)
	if !ok || userID == "" {
		return "", fmt.Errorf("no user ID in claims")
	}

	return userID, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}