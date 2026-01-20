package room

type Role string

const (
	Listener Role = "listener"
	Speaker  Role = "speaker"
	Host     Role = "host"
)
