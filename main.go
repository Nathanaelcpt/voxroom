package main

import (
	"log"
	"net/http"
	"os"

	"voxroom/backend/auth"
	"voxroom/backend/db"
	"voxroom/backend/ws"
)

func main() {
	// ======================
	// DATABASE
	// ======================
	if err := db.Connect(os.Getenv("DATABASE_URL")); err != nil {
		log.Fatal(err)
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

	// Protected example
	mux.Handle("/rooms", auth.AuthMiddleware(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := r.Context().Value(auth.UserIDKey).(string)
			w.Write([]byte("hello user " + userID))
		}),
	))

	// WebSocket (optional auth nanti)
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
