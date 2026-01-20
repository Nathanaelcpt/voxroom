package main

import (
	"log"
	"net/http"
	"os"

	"voxroom/internal/auth"
	"voxroom/internal/db"
	"voxroom/internal/ws"
)

func main() {
	// ======================
	// ENV & DATABASE
	// ======================
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	if err := db.Connect(databaseURL); err != nil {
		log.Fatal(err)
	}

	// ======================
	// WEBSOCKET HUB (SIGNALLING)
	// ======================
	hub := ws.NewHub()
	go hub.Run()

	// ======================
	// HTTP ROUTES
	// ======================
	http.HandleFunc("/register", auth.RegisterHandler)
	http.HandleFunc("/login", auth.LoginHandler)

	// 🔥 WebSocket signalling (WebRTC)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, w, r)
	})

	// ======================
	// PORT (Render / Local)
	// ======================
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ======================
	// CORS MIDDLEWARE
	// ======================
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		http.DefaultServeMux.ServeHTTP(w, r)
	})

	log.Println("🚀 Server running on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
