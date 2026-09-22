window.VOICEOPS_CONFIG = {
  region: "us-east-1",

  // Output named IdentityPoolId from cloudformation/frontend.yaml
  identityPoolId: "REPLACE_WITH_IDENTITY_POOL_ID",

  // Output named ApiBaseUrl from cloudformation/direct-backend-fixed.yaml
  // Example: https://abc123.execute-api.us-east-1.amazonaws.com
  apiBaseUrl: "REPLACE_WITH_API_BASE_URL",

  // Set to 0 to disable automatic CloudWatch dashboard refresh.
  refreshIntervalSeconds: 30
};
