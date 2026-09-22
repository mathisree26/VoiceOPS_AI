# Runbook: Database Connection Pool Exhaustion

## Symptoms
- high checkout-api latency
- HTTP 503 responses
- `DB_CONNECTION_TIMEOUT`
- connection acquisition timeouts
- active connections at the maximum
- zero idle connections

## Checkout API Pool Configuration
- max_pool_size = 50
- connection acquisition timeout = 3000 ms

## Diagnosis
If:
- active_connections = 50
- max_pool_size = 50
- idle_connections = 0
- DB connection timeout errors are present

then database connection pool exhaustion is likely.

If CPU and memory remain healthy, the bottleneck is more likely database connectivity than application compute capacity.

## Investigation
Check:
- slow or long-running SQL queries
- blocked database sessions
- database capacity
- connection leaks
- recent pool configuration changes
- recent application deployments

## Remediation
- optimize or terminate problematic long-running queries
- restore database capacity
- fix connection leaks
- change pool settings only after validating database capacity
- roll back a correlated bad deployment
