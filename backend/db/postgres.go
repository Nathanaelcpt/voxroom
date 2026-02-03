package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// Pool untuk REST API (Transaction Mode - Port 6543)
	Pool *pgxpool.Pool
	
	// WSPool untuk WebSocket (Session Mode - Port 5432)
	WSPool *pgxpool.Pool
)

// Connect establishes connection to PostgreSQL with optimized pool settings
func Connect(databaseURL string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// =============================================
	// 1. REST API Pool - Transaction Mode
	// =============================================
	
	// ✅ Verify using transaction pooler (port 6543)
	if !strings.Contains(databaseURL, ":6543") {
		log.Println("⚠️ WARNING: DATABASE_URL should use port 6543 (transaction pooler)")
		log.Println("   For better performance, update to: ...pooler.supabase.com:6543/...")
	}

	// ✅ Parse connection config
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return fmt.Errorf("failed to parse database URL: %w", err)
	}

	// ✅ Force SSL check (important for Supabase)
	if config.ConnConfig.TLSConfig == nil {
		return fmt.Errorf("SSL is required but not configured in DATABASE_URL")
	}

	// ✅ Optimize connection pool settings for REST API
	config.MaxConns = 20                           // Max connections in pool
	config.MinConns = 5                            // Keep warm connections
	config.MaxConnLifetime = 30 * time.Minute      // Recycle connections
	config.MaxConnIdleTime = 5 * time.Minute       // Close idle connections faster
	config.HealthCheckPeriod = 1 * time.Minute     // Health check interval
	config.ConnConfig.ConnectTimeout = 15 * time.Second

	log.Println("📡 Creating REST API connection pool (Transaction Mode)...")
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

	log.Println("✅ REST API Database pool established (Transaction Mode)")
	log.Printf("   MaxConns: %d, MinConns: %d, Port: 6543", config.MaxConns, config.MinConns)

	// =============================================
	// 2. WebSocket Pool - Session Mode (Optional)
	// =============================================
	wsURL := os.Getenv("WS_DATABASE_URL")
	if wsURL != "" {
		// ✅ Verify using session pooler (port 5432)
		if !strings.Contains(wsURL, ":5432") {
			log.Println("⚠️ WARNING: WS_DATABASE_URL should use port 5432 (session pooler)")
		}

		wsConfig, err := pgxpool.ParseConfig(wsURL)
		if err != nil {
			log.Printf("⚠️ Failed to parse WS_DATABASE_URL: %v", err)
		} else {
			// ✅ Session pool settings for WebSocket
			wsConfig.MaxConns = 50                        // Support many concurrent WS clients
			wsConfig.MinConns = 10                        // Keep warm for real-time
			wsConfig.MaxConnLifetime = 2 * time.Hour      // Longer lifetime for persistent
			wsConfig.MaxConnIdleTime = 30 * time.Minute   // Tolerate longer idle
			wsConfig.HealthCheckPeriod = 2 * time.Minute
			wsConfig.ConnConfig.ConnectTimeout = 15 * time.Second

			log.Println("📡 Creating WebSocket connection pool (Session Mode)...")
			WSPool, err = pgxpool.NewWithConfig(ctx, wsConfig)
			if err != nil {
				log.Printf("⚠️ Failed to create WebSocket pool: %v", err)
				WSPool = Pool // Fallback to REST pool
			} else {
				if err := pingWithRetry(WSPool, 3); err != nil {
					log.Printf("⚠️ WebSocket pool ping failed: %v", err)
					WSPool.Close()
					WSPool = Pool // Fallback to REST pool
				} else {
					log.Println("✅ WebSocket Database pool established (Session Mode)")
					log.Printf("   MaxConns: %d, MinConns: %d, Port: 5432", wsConfig.MaxConns, wsConfig.MinConns)
				}
			}
		}
	} else {
		log.Println("ℹ️  WS_DATABASE_URL not set, using REST pool for WebSocket (sub-optimal)")
		WSPool = Pool // Fallback to REST pool
	}

	// ✅ Start background health monitor
	go monitorConnection(Pool, "REST")
	if WSPool != nil && WSPool != Pool {
		go monitorConnection(WSPool, "WebSocket")
	}

	return nil
}

// Close closes the database connection pool
func Close() {
	if Pool != nil {
		Pool.Close()
		log.Println("✅ REST API Database pool closed")
	}
	if WSPool != nil && WSPool != Pool {
		WSPool.Close()
		log.Println("✅ WebSocket Database pool closed")
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
func monitorConnection(pool *pgxpool.Pool, poolName string) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := pool.Ping(ctx)
		cancel()

		if err != nil {
			log.Printf("⚠️ %s pool health check failed: %v", poolName, err)
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

// ✅ GetPool returns appropriate pool based on context
func GetPool(forWebSocket bool) *pgxpool.Pool {
	if forWebSocket && WSPool != nil && WSPool != Pool {
		return WSPool
	}
	return Pool
}
