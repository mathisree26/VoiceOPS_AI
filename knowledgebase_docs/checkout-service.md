# Checkout API Service

## Service
`checkout-api`

## Purpose
The checkout-api handles customer checkout requests and coordinates order creation and payment-related processing.

## Normal Operating Thresholds
- Latency: less than 300 ms
- Error rate: less than 1%
- CPU utilization: less than 70%
- Memory utilization: less than 75%

## Database Connection Pool
- Maximum pool size: 50
- Connection acquisition timeout: 3000 ms

## Operational Notes
High latency and elevated errors do not always mean CPU or memory pressure.

If latency and error rate are high while CPU and memory remain healthy, investigate database connectivity and downstream dependencies.

A strong signal of database connection pool exhaustion is:
- active_connections = max_pool_size
- idle_connections = 0
- repeated DB_CONNECTION_TIMEOUT errors
