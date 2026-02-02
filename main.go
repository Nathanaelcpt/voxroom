package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"
	"voxroom/backend/room"
	"voxroom/backend/social"
	"voxroom/backend/ws"
)

func main() {
	// ======================
	// DATABASE CONNECTION
	// ======================
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("❌ DATABASE_URL not set")
	}

	var err error
	for i := 1; i <= 5; i++ {
		log.Printf("🔌 Connecting to database (attempt %d/5)...", i)
		err = db.Connect(databaseURL)
		if err == nil {
			log.Println("✅ Database connected successfully")
			break
		}
		if i < 5 {
			delay := time.Duration(i) * 3 * time.Second
			log.Printf("⏳ Retrying in %v...", delay)
			time.Sleep(delay)
		}
	}

	if err != nil {
		log.Fatalf("❌ Failed to connect to database after 5 attempts: %v", err)
	}
	defer db.Close()

	// ======================
	// WEBSOCKET HUB
	// ======================
	hub := ws.NewHub()
	go hub.Run()

	// ======================
	// ROUTES
	// ======================
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", handleHealth)

	// Room management (public)
	mux.HandleFunc("GET /rooms", room.GetActiveRooms)

	// Room management (protected)
	mux.HandleFunc("POST /rooms", withAuth(room.CreateRoom))

	// Room operations (need custom routing because of path parameters)
	mux.HandleFunc("/rooms/", handleRoomRoutes)

	// WebSocket (NO AUTH MIDDLEWARE - handled inside ServeWS)
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, w, r)
	}) // ✅ FIXED: Added closing brace here

	// ======================
	// SOCIAL FEATURES ROUTES
	// ======================
	
	// Following system
	mux.HandleFunc("POST /social/follow", withAuth(social.FollowUser))
	mux.HandleFunc("POST /social/unfollow", withAuth(social.UnfollowUser))
	mux.HandleFunc("/social/", handleSocialRoutes) // Handles /social/{id}/followers and /social/{id}/following
	
	// Online friends
	mux.HandleFunc("GET /social/online-friends", withAuth(social.GetOnlineFriends))
	// In SOCIAL FEATURES ROUTES section
	mux.HandleFunc("GET /users/search", withAuth(social.SearchUsers))
	mux.HandleFunc("POST /presence/online", withAuth(social.SetPresenceOnline))
	mux.HandleFunc("POST /presence/offline", withAuth(social.SetPresenceOffline))

	// ======================
	// CORS + START SERVER
	// ======================
	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("🚀 Server starting...")
	log.Printf("📍 Port: %s", port)
	log.Println("📋 Registered routes:")
	log.Println("   GET  /health")
	log.Println("   GET  /rooms")
	log.Println("   POST /rooms")
	log.Println("   GET  /rooms/{id}")
	log.Println("   POST /rooms/{id}/join")
	log.Println("   POST /rooms/{id}/end")
	log.Println("   POST /rooms/{id}/invite-speaker")
	log.Println("   POST /rooms/{id}/remove-speaker")
	log.Println("   WS   /ws")
	log.Println("   POST /social/follow")
	log.Println("   POST /social/unfollow")
	log.Println("   GET  /social/{id}/followers")
	log.Println("   GET  /social/{id}/following")
	log.Println("   GET  /social/online-friends")
	log.Println("   GET  /users/search")
	log.Println("   POST /presence/online")
	log.Println("   POST /presence/offline")

	log.Fatal(http.ListenAndServe(":"+port, handler))
}

// ======================
// ROUTE HANDLERS
// ======================

func handleHealth(w http.ResponseWriter, r *http.Request) {
	// Check database health
	dbHealthy := true
	dbError := ""
	
	if err := db.HealthCheck(); err != nil {
		dbHealthy = false
		dbError = err.Error()
	}

	status := "healthy"
	httpStatus := http.StatusOK
	
	if !dbHealthy {
		status = "degraded"
		httpStatus = http.StatusServiceUnavailable
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	
	response := map[string]interface{}{
		"status":  status,
		"service": "voxroom-backend",
		"database": map[string]interface{}{
			"healthy": dbHealthy,
		},
	}
	
	if dbError != "" {
		response["database"].(map[string]interface{})["error"] = dbError
	}
	
	json.NewEncoder(w).Encode(response)
}

// handleRoomRoutes handles all /rooms/* routes with proper routing
func handleRoomRoutes(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Extract room ID and action
	parts := strings.Split(strings.TrimPrefix(path, "/rooms/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "room id required", http.StatusBadRequest)
		return
	}

	roomID := parts[0]
	action := ""
	if len(parts) > 1 {
		action = parts[1]
	}

	// ✅ Add logging to use roomID variable
	log.Printf("🔀 Room route: %s /rooms/%s/%s", r.Method, roomID, action)

	// Route based on method and action
	switch {
	case r.Method == "GET" && action == "":
		// GET /rooms/{id} - Get room details
		room.GetRoomDetails(w, r)

	case r.Method == "POST" && action == "join":
		// POST /rooms/{id}/join - Join room
		auth.AuthMiddleware(http.HandlerFunc(room.JoinRoom)).ServeHTTP(w, r)

	case r.Method == "POST" && action == "end":
		// POST /rooms/{id}/end - End room (host only)
		auth.AuthMiddleware(http.HandlerFunc(room.EndRoomHandler)).ServeHTTP(w, r)

	case r.Method == "POST" && action == "invite-speaker":
		// POST /rooms/{id}/invite-speaker - Invite speaker (host only)
		auth.AuthMiddleware(http.HandlerFunc(room.InviteSpeaker)).ServeHTTP(w, r)

	case r.Method == "POST" && action == "remove-speaker":
		// POST /rooms/{id}/remove-speaker - Remove speaker (host only)
		auth.AuthMiddleware(http.HandlerFunc(room.RemoveSpeaker)).ServeHTTP(w, r)

	case r.Method == "GET" && action == "participants-with-profiles":
		room.GetParticipantsWithProfilesHandler(w, r)

	default:
		http.Error(w, "not found", http.StatusNotFound)
	}
}

// handleSocialRoutes handles /social/* routes
func handleSocialRoutes(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	
	// Extract user ID and action
	parts := strings.Split(strings.TrimPrefix(path, "/social/"), "/")
	if len(parts) < 2 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	
	userID := parts[0]
	action := parts[1]
	
	log.Printf("🔀 Social route: %s /social/%s/%s", r.Method, userID, action)
	
	switch {
	case r.Method == "GET" && action == "followers":
		social.GetFollowers(w, r)
	case r.Method == "GET" && action == "following":
		social.GetFollowing(w, r)
	default:
		http.Error(w, "not found", http.StatusNotFound)
	}
}

// ======================
// MIDDLEWARE
// ======================

// withAuth wraps a handler with authentication middleware
func withAuth(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth.AuthMiddleware(http.HandlerFunc(handler)).ServeHTTP(w, r)
	}
}

// corsMiddleware adds CORS headers to all responses
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Log incoming request
		log.Printf("📨 %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

		// Set CORS headers
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight
		if r.Method == http.MethodOptions {
			log.Printf("✅ CORS preflight: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusOK)
			return
		}

		// Continue to next handler
		next.ServeHTTP(w, r)
	})
}
