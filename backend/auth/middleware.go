package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type contextKey string

const UserIDKey contextKey = "user_id"

// Supabase user response
type SupabaseUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// Cache untuk performa
var (
	tokenCache = make(map[string]*CachedUser)
	cacheMu    sync.RWMutex
)

type CachedUser struct {
	UserID    string
	ExpiresAt time.Time
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

		token := parts[1]
		log.Printf("🎫 Token received: %s...", token[:min(20, len(token))])

		// Check cache first (avoid calling Supabase every time)
		cacheMu.RLock()
		if cached, ok := tokenCache[token]; ok {
			if time.Now().Before(cached.ExpiresAt) {
				cacheMu.RUnlock()
				log.Printf("✅ Auth from cache - User ID: %s", cached.UserID)
				ctx := context.WithValue(r.Context(), UserIDKey, cached.UserID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}
		cacheMu.RUnlock()

		// Validate with Supabase
		user, err := validateTokenWithSupabase(r.Context(), token)
		if err != nil {
			log.Printf("❌ Token validation failed: %v", err)
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		log.Printf("✅ Auth successful - User ID: %s, Email: %s", user.ID, user.Email)

		// Cache for 5 minutes
		cacheMu.Lock()
		tokenCache[token] = &CachedUser{
			UserID:    user.ID,
			ExpiresAt: time.Now().Add(5 * time.Minute),
		}
		cacheMu.Unlock()

		ctx := context.WithValue(r.Context(), UserIDKey, user.ID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ValidateToken - exported for WebSocket auth
func ValidateToken(ctx context.Context, token string) (*SupabaseUser, error) {
	// Check cache first
	cacheMu.RLock()
	if cached, ok := tokenCache[token]; ok {
		if time.Now().Before(cached.ExpiresAt) {
			cacheMu.RUnlock()
			// Return cached user (need to fetch from cache or create simple struct)
			return &SupabaseUser{ID: cached.UserID}, nil
		}
	}
	cacheMu.RUnlock()

	return validateTokenWithSupabase(ctx, token)
}

func validateTokenWithSupabase(ctx context.Context, token string) (*SupabaseUser, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL == "" {
		supabaseURL = "https://ecvtonwwjwjixwfhjtdh.supabase.co"
	}

	apiKey := os.Getenv("SUPABASE_ANON_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("SUPABASE_ANON_KEY not set")
	}

	// Call Supabase auth/v1/user endpoint
	url := fmt.Sprintf("%s/auth/v1/user", strings.TrimSuffix(supabaseURL, "/"))

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request error: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("apikey", apiKey)

	log.Printf("🔍 Validating token with Supabase: %s", url)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid token: status %d", resp.StatusCode)
	}

	var user SupabaseUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("decode error: %w", err)
	}

	if user.ID == "" {
		return nil, fmt.Errorf("invalid user data")
	}

	log.Printf("✅ Token validated - User: %s (%s)", user.ID, user.Email)

	return &user, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}