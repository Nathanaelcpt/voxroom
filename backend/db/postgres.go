package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect(databaseURL string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Parse config
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return fmt.Errorf("parse config error: %w", err)
	}

	// 🔥 TAMBAHKAN: Force SSL
	if config.ConnConfig.TLSConfig == nil {
		return fmt.Errorf("SSL is required but not configured in DATABASE_URL")
	}

	// Connection pool settings
	config.MaxConns = 5
	config.MinConns = 1
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	fmt.Println("📡 Creating connection pool...")
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("create pool error: %w", err)
	}

	fmt.Println("🏓 Pinging database...")
	if err = pool.Ping(ctx); err != nil {
		pool.Close() // cleanup
		return fmt.Errorf("ping error: %w", err)
	}

	Pool = pool
	fmt.Println("✅ Connected to PostgreSQL")
	return nil
}