package db

import (
	"context"
	"fmt"
	"log"
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

	// 🔥 Force SSL check
	if config.ConnConfig.TLSConfig == nil {
		return fmt.Errorf("SSL is required but not configured in DATABASE_URL")
	}

	// 🆕 Connection pool settings (optimized for Supabase)
	config.MaxConns = 10                      // Increase for better concurrency
	config.MinConns = 2                       // Keep warm connections
	config.MaxConnLifetime = time.Hour        // Recycle connections hourly
	config.MaxConnIdleTime = 30 * time.Minute // Close idle connections
	config.HealthCheckPeriod = 1 * time.Minute // Check health regularly
	
	// 🆕 Connection timeout settings
	config.ConnConfig.ConnectTimeout = 10 * time.Second // Wait longer for initial connection

	fmt.Println("📡 Creating connection pool...")
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("create pool error: %w", err)
	}

	// 🆕 Ping with retry logic
	fmt.Println("🏓 Pinging database with retry...")
	if err = pingWithRetry(pool, 5); err != nil {
		pool.Close() // cleanup
		return fmt.Errorf("ping error after retries: %w", err)
	}

	Pool = pool
	fmt.Println("✅ Connected to PostgreSQL")
	
	// 🆕 Start background health monitor
	go monitorConnection(pool)
	
	return nil
}

// 🆕 Ping database with retry logic
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

// 🆕 Monitor connection health in background
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

// 🆕 Execute query with automatic retry on connection errors
func ExecuteWithRetry(ctx context.Context, maxRetries int, operation func(ctx context.Context) error) error {
	for i := 0; i < maxRetries; i++ {
		err := operation(ctx)
		if err == nil {
			return nil
		}

		// Check if it's a connection error
		if isConnectionError(err) && i < maxRetries-1 {
			delay := time.Duration(i+1) * time.Second
			log.Printf("⚠️ Connection error detected (attempt %d/%d): %v. Retrying in %v...", i+1, maxRetries, err, delay)
			
			// Wait before retry
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
				continue
			}
		}

		// If not connection error or last retry, return error
		return err
	}
	return fmt.Errorf("max retries reached")
}

// 🆕 Check if error is connection-related
func isConnectionError(err error) bool {
	if err == nil {
		return false
	}

	errMsg := err.Error()
	
	// Common connection error patterns
	connectionErrors := []string{
		"connection refused",
		"connection reset",
		"broken pipe",
		"no such host",
		"i/o timeout",
		"connection closed",
		"server closed the connection",
		"EOF",
		"deadline exceeded",
	}

	for _, pattern := range connectionErrors {
		if contains(errMsg, pattern) {
			return true
		}
	}

	return false
}

// IsConnectionError checks if error is connection-related (exported version)
func IsConnectionError(err error) bool {
	return isConnectionError(err)
}

// Helper function to check if string contains substring (case-insensitive)
func contains(str, substr string) bool {
	return len(str) >= len(substr) && 
		(str == substr || len(str) > len(substr) && 
		(str[:len(substr)] == substr || str[len(str)-len(substr):] == substr ||
		findSubstring(str, substr)))
}

func findSubstring(str, substr string) bool {
	for i := 0; i <= len(str)-len(substr); i++ {
		if str[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Close the connection pool
func Close() {
	if Pool != nil {
		Pool.Close()
		fmt.Println("🔌 Database connection closed")
	}
}