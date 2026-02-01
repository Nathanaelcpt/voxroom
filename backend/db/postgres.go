package db

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

// Connect establishes connection to PostgreSQL with optimized pool settings
func Connect(databaseURL string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// ✅ Parse connection config
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return fmt.Errorf("failed to parse database URL: %w", err)
	}

	// ✅ Force SSL check (important for Supabase)
	if config.ConnConfig.TLSConfig == nil {
		return fmt.Errorf("SSL is required but not configured in DATABASE_URL")
	}

	// ✅ Optimize connection pool settings
	config.MaxConns = 20                           // Max connections in pool
	config.MinConns = 2                            // Min idle connections
	config.MaxConnLifetime = time.Hour             // Recycle connections after 1 hour
	config.MaxConnIdleTime = 30 * time.Minute      // Close idle connections after 30 min
	config.HealthCheckPeriod = 1 * time.Minute     // Health check interval
	config.ConnConfig.ConnectTimeout = 15 * time.Second // ✅ Connection timeout

	log.Println("📡 Creating connection pool...")
	Pool, err = pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("failed to create connection pool: %w", err)
	}

	// ✅ Ping with retry logic
	log.Println("🏓 Pinging database with retry...")
	if err := pingWithRetry(Pool, 5); err != nil {
		Pool.Close()
		return fmt.Errorf("ping error after retries: %w", err)
	}

	log.Println("✅ Database connection pool established")
	log.Printf("   MaxConns: %d, MinConns: %d", config.MaxConns, config.MinConns)

	// ✅ Start background health monitor
	go monitorConnection(Pool)

	return nil
}

// Close closes the database connection pool
func Close() {
	if Pool != nil {
		Pool.Close()
		log.Println("✅ Database connection pool closed")
	}
}

// HealthCheck performs a database health check
func HealthCheck() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := Pool.Ping(ctx); err != nil {
		log.Printf("⚠️ Database health check failed: %v", err)
		return err
	}

	return nil
}

// pingWithRetry pings database with retry logic
func pingWithRetry(pool *pgxpool.Pool, maxRetries int) error {
	for i := 0; i < maxRetries; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := pool.Ping(ctx)
		cancel()

		if err == nil {
			if i > 0 {
				log.Printf("✅ Database ping succeeded on attempt %d/%d", i+1, maxRetries)
			}
			return nil
		}

		if i < maxRetries-1 {
			delay := time.Duration(i+1) * 2 * time.Second // Exponential backoff: 2s, 4s, 6s, 8s, 10s
			log.Printf("⚠️ Database ping failed (attempt %d/%d): %v. Retrying in %v...", i+1, maxRetries, err, delay)
			time.Sleep(delay)
		}
	}
	return fmt.Errorf("failed to ping database after %d attempts", maxRetries)
}

// monitorConnection monitors connection health in background
func monitorConnection(pool *pgxpool.Pool) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := pool.Ping(ctx)
		cancel()

		if err != nil {
			log.Printf("⚠️ Database health check failed: %v", err)
		}
	}
}

// ExecuteWithRetry executes a function with retry logic
func ExecuteWithRetry(ctx context.Context, maxRetries int, fn func(context.Context) error) error {
	var err error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		err = fn(ctx)
		if err == nil {
			return nil // Success
		}

		// Check if context is already canceled
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Check if it's a connection error that should be retried
		if isConnectionError(err) && attempt < maxRetries {
			delay := time.Duration(attempt) * 500 * time.Millisecond
			log.Printf("⏳ Retry attempt %d/%d after %v (connection error: %v)", attempt, maxRetries, delay, err)

			select {
			case <-time.After(delay):
				// Continue to next attempt
			case <-ctx.Done():
				return ctx.Err()
			}
			continue
		}

		// Don't retry on last attempt or non-connection errors
		if attempt == maxRetries {
			break
		}

		// Exponential backoff for other errors
		delay := time.Duration(attempt) * 500 * time.Millisecond
		log.Printf("⏳ Retry attempt %d/%d after %v (error: %v)", attempt, maxRetries, delay, err)

		select {
		case <-time.After(delay):
			// Continue to next attempt
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	return err
}

// isConnectionError checks if error is connection-related
func isConnectionError(err error) bool {
	if err == nil {
		return false
	}

	errMsg := strings.ToLower(err.Error())

	// Common connection error patterns
	connectionErrors := []string{
		"connection refused",
		"connection reset",
		"broken pipe",
		"no such host",
		"i/o timeout",
		"connection closed",
		"server closed the connection",
		"eof",
		"deadline exceeded",
		"context deadline exceeded",
		"network is unreachable",
		"connection timed out",
	}

	for _, pattern := range connectionErrors {
		if strings.Contains(errMsg, pattern) {
			return true
		}
	}

	return false
}

// IsConnectionError checks if error is connection-related (exported version)
func IsConnectionError(err error) bool {
	return isConnectionError(err)
}
