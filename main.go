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
	// Database
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

	// WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Routes
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /health", handleHealth)

	// 🆕 Room endpoints
	mux.HandleFunc("GET /rooms", room.GetActiveRooms)
	mux.HandleFunc("POST /rooms", withAuth(room.CreateRoom))
	mux.HandleFunc("GET /rooms/{roomId}", room.GetRoomDetails)
	mux.HandleFunc("POST /rooms/{roomId}/join", withAuth(room.JoinRoom))

	// WebSocket
	mux.Handle("/ws", auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	log.Printf("🔌 WebSocket connection from %s", r.RemoteAddr)
	ws.ServeWS(hub, w, r)
	})))


	// CORS wrapper
	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Backend running on :%s", port)
	log.Println("📋 Routes:")
	log.Println("   GET  /health")
	log.Println("   GET  /rooms")
	log.Println("   POST /rooms")
	log.Println("   GET  /rooms/{roomId}")
	log.Println("   POST /rooms/{roomId}/join")
	log.Println("   WS   /ws")

	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func withAuth(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("📥 %s %s (protected)", r.Method, r.URL.Path)
		auth.AuthMiddleware(http.HandlerFunc(handler)).ServeHTTP(w, r)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	log.Println("📍 Health check")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"healthy","service":"voxroom-backend"}`))
}

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