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
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	// 🔹 Connect DB
	if err := db.Connect(databaseURL); err != nil {
		log.Fatal(err)
	}

	// 🔹 Init WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// 🔹 HTTP routes
	http.HandleFunc("/register", auth.RegisterHandler)
	http.HandleFunc("/login", auth.LoginHandler)

	// 🔹 WebSocket endpoint
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(hub, w, r)
	})

	log.Println("🚀 Server running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
