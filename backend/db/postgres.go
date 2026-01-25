package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect(databaseURL string) error {
	// 🔥 PERBAIKKAN: Timeout lebih lama untuk production
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return fmt.Errorf("parse config error: %w", err)
	}

	// Optional: Tuning connection pool
	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("create pool error: %w", err)
	}

	// Test ping
	if err = pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping error: %w", err)
	}

	Pool = pool
	fmt.Println("✅ Connected to PostgreSQL")
	return nil
}