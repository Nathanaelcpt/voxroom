package auth

import (
	"encoding/json"
	"net/http"
)

type request struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req request
	json.NewDecoder(r.Body).Decode(&req)

	err := Register(req.Username, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req request
	json.NewDecoder(r.Body).Decode(&req)

	token, err := Login(req.Username, req.Password)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"token": token,
	})
}
