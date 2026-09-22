# Order Worker Lambda Service

## Service
`order-worker`

## Purpose
The `order-worker` Lambda performs downstream order processing invoked by `checkout-api`.

## Important Metrics
- Invocations
- ConcurrentExecutions
- ConcurrencyLimit
- Throttles
- Duration

## Normal Behavior
Healthy operation should have:
- ConcurrentExecutions below the configured concurrency limit
- Throttles close to zero
- stable duration
- no repeated `TooManyRequestsException`

## Throttling Signal
A strong Lambda throttling signal is:
- ConcurrentExecutions reaches the configured concurrency limit
- Throttles increase
- `TooManyRequestsException: Rate Exceeded`
- checkout-api begins retrying or failing downstream calls
