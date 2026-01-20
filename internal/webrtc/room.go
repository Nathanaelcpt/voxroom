package webrtc

import "sync"

type Room struct {
	ID        string
	Speakers  map[string]*Peer
	Listeners map[string]*Peer
	mu        sync.Mutex
}

func NewRoom(id string) *Room {
	return &Room{
		ID:        id,
		Speakers:  make(map[string]*Peer),
		Listeners: make(map[string]*Peer),
	}
}

func (r *Room) AddSpeaker(userID string, p *Peer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Speakers[userID] = p
}

func (r *Room) AddListener(userID string, p *Peer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Listeners[userID] = p
}

func (r *Room) Remove(userID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Speakers, userID)
	delete(r.Listeners, userID)
}
