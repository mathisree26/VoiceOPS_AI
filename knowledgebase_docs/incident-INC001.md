# Incident INC001: Checkout API Connection Pool Exhaustion

## Summary
The checkout-api experienced high latency and elevated 503 errors after a deployment.

## Evidence
- latency significantly above the normal 300 ms threshold
- error rate above the normal 1% threshold
- repeated `DB_CONNECTION_TIMEOUT`
- HTTP 503 responses
- CPU healthy
- memory healthy
- active_connections = 50
- idle_connections = 0
- max_pool_size = 50
- acquisition timeout = 3000 ms

## Root Cause
A deployment introduced an incorrect database connection-pool configuration.

All available database connections were consumed. New requests could not acquire a connection within the configured timeout.

## Resolution
The team rolled back the correlated deployment.

After rollback:
- idle database connections returned
- checkout latency returned toward baseline
- error rate declined

## Lesson
High latency + high errors + normal CPU/memory + DB timeouts + active=max + idle=0 is a strong signal of connection pool exhaustion.
