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
	for i := 1; i <= 3; i++ {
		log.Println("🔌 Connecting to database (attempt", i, ")...")
		err = db.Connect(databaseURL)
		if err == nil {
			break
		}
		log.Println("⏳ DB not ready, retry in 5s...")
		time.Sleep(5 * time.Second)
	}

	if err != nil {
		log.Fatal("❌ DB CONNECT ERROR:", err)
	}

	// ======================
	// WEBSOCKET HUB
	// ======================
	hub := ws.NewHub()
	go hub.Run()

	// ======================
	// ROUTES
	// ======================
	mux := http.NewServeMux()

	// CREATE ROOM (protected)
	mux.Handle(
		"/rooms",
		auth.AuthMiddleware(http.HandlerFunc(room.CreateRoom)),
	)

	// WebSocket
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, w, r)
	})

	// ======================
	// CORS
	// ======================
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		mux.ServeHTTP(w, r)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("🚀 Backend running on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
