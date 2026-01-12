package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect(databaseURL string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return err
	}

	// test ping
	err = pool.Ping(ctx)
	if err != nil {
		return err
	}

	Pool = pool
	fmt.Println("✅ Connected to PostgreSQL")
	return nil
}
