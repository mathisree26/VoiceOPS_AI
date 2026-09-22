# Runbook: Checkout API High Latency

## Trigger
Use this runbook when `checkout-api` shows sustained high latency or elevated errors.

## Healthy Baseline
- Latency: < 300 ms
- Error rate: < 1%
- CPU: < 70%
- Memory: < 75%

## Investigation
1. Check checkout-api latency and error rate.
2. Check CPU and memory.
3. Review recent application logs.
4. Look for `DB_CONNECTION_TIMEOUT`.
5. Inspect database pool values:
   - active_connections
   - idle_connections
   - max_pool_size

## Connection Pool Exhaustion Pattern
A strong pattern is:
- active_connections = max_pool_size
- idle_connections = 0
- repeated `DB_CONNECTION_TIMEOUT`
- elevated latency
- elevated 503/error rate
- CPU and memory remain healthy

Example:
- active_connections = 50
- idle_connections = 0
- max_pool_size = 50
- acquisition timeout = 3000 ms

## Likely Causes
- long-running database queries
- database capacity pressure
- application connection leaks
- incorrect pool configuration
- recent deployment affecting database connectivity

## Recommended Actions
- inspect long-running queries
- check database health and capacity
- review recent connection-pool changes
- review recent deployments
- roll back a correlated bad deployment if appropriate
- reduce load temporarily if required
