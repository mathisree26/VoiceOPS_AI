# Runbook: Lambda Throttling on order-worker

## Trigger
Use this runbook when `checkout-api` reports failures calling `order-worker` or CloudWatch shows throttling on `order-worker`.

## Key Metrics
Review:
- Invocations
- ConcurrentExecutions
- ConcurrencyLimit
- Throttles
- Duration

## Throttling Pattern
A strong throttling pattern is:
- ConcurrentExecutions approaches or reaches ConcurrencyLimit
- Throttles become greater than zero
- application logs contain `TooManyRequestsException`
- retries increase
- checkout requests may fail with downstream 503 errors

Example:
- ConcurrentExecutions = 50
- ConcurrencyLimit = 50
- Throttles = 18
- retry_attempts = 3

## Likely Causes
- traffic spike
- reserved concurrency too low
- downstream work taking longer, causing concurrent executions to accumulate
- insufficient concurrency capacity for current load

## Recommended Actions
- check whether traffic increased
- review reserved or provisioned concurrency settings
- inspect Lambda duration for slow execution
- identify slow downstream dependencies
- increase concurrency only if downstream systems can handle the additional load
- reduce retries or incoming load temporarily if needed

## Expected Diagnosis
If concurrency is at the configured limit and throttles are increasing with `TooManyRequestsException`, `order-worker` is being throttled.
