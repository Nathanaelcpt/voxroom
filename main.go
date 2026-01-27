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
			log.Println("✅ Database connected")
			break
		}
		time.Sleep(time.Duration(i) * 3 * time.Second)
	}
	if err != nil {
		log.Fatal("❌ DB CONNECT ERROR:", err)
	}
	defer db.Close()

	// WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /health", handleHealth)

	// Rooms
	mux.HandleFunc("GET /rooms", room.GetActiveRooms)
	mux.HandleFunc("POST /rooms", withAuth(room.CreateRoom))

	// Prefix routing (AMAN)
	mux.HandleFunc("GET /rooms/", room.GetRoomDetails)
	mux.HandleFunc("POST /rooms/", withAuth(room.JoinRoom))

	// WebSocket (AUTH)
	mux.Handle("/ws", withAuthWS(func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, w, r)
	}))

	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Backend running on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

//
// ================= HELPER =================
//

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"healthy"}`))
}

func withAuth(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth.AuthMiddleware(http.HandlerFunc(handler)).ServeHTTP(w, r)
	}
}

// khusus WebSocket (AuthMiddleware + HandlerFunc)
func withAuthWS(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth.AuthMiddleware(http.HandlerFunc(handler)).ServeHTTP(w, r)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
