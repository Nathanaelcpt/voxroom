package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"voxroom/backend/auth"
	"voxroom/backend/db"
	"voxroom/backend/room"
	"voxroom/backend/ws"
)

func main() {
	// ======================
	// DATABASE (retry friendly)
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
			log.Printf("⏳ DB not ready, retry in %v...", delay)
			time.Sleep(delay)
		}
	}

	if err != nil {
		log.Fatal("❌ DB CONNECT ERROR:", err)
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

	// 🆕 Protected routes dengan helper
	mux.HandleFunc("POST /rooms", withAuth(room.CreateRoom))

	// WebSocket
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("🔌 WebSocket connection from %s", r.RemoteAddr)
		ws.ServeWS(hub, w, r)
	})

	// ======================
	// CORS WRAPPER
	// ======================
	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Backend running on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

// 🆕 Helper: wrap handler dengan auth
func withAuth(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("📥 %s %s (protected)", r.Method, r.URL.Path)
		auth.AuthMiddleware(http.HandlerFunc(handler)).ServeHTTP(w, r)
	}
}

// 🆕 Health check handler
func handleHealth(w http.ResponseWriter, r *http.Request) {
	log.Println("📍 Health check")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"healthy","service":"voxroom-backend"}`))
}

// 🆕 CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("📨 %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)

		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			log.Printf("✅ CORS preflight for %s", r.URL.Path)
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}