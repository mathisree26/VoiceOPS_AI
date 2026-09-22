# Incident INC002: order-worker Lambda Throttling

## Summary
During a traffic increase, checkout-api experienced downstream failures while invoking `order-worker`.

## Evidence
- order-worker concurrent executions reached 50
- configured concurrency limit was 50
- Lambda throttles increased
- logs showed `TooManyRequestsException: Rate Exceeded`
- checkout-api retried downstream calls
- some checkout requests returned 503

## Root Cause
`order-worker` reached its configured concurrency limit during increased request volume.

New Lambda invocations were throttled until execution capacity became available.

## Resolution
The team reduced immediate pressure and increased available Lambda concurrency after confirming downstream systems could support it.

## Lesson
When ConcurrentExecutions equals ConcurrencyLimit and Throttles are non-zero, Lambda concurrency exhaustion should be investigated before attributing the failure to checkout-api itself.
