window.VOICEOPS_CONFIG = {
  region: "us-east-1",

  // Cognito User Pool authentication
  userPoolId: "us-east-1_FSv9fcuXW",
  userPoolClientId: "14n6p3cldvnnf7vdgjvlaidt8c",

  cognitoDomain:
    "https://voiceops-141701955576-demo.auth.us-east-1.amazoncognito.com",

  redirectUri:
    "https://voiceopsaihackathon.dev/",

  logoutUri:
    "https://voiceopsaihackathon.dev/",

  // Cognito Identity Pool
  identityPoolId:
    "us-east-1:8ec5830f-6da9-46dd-8289-06d274540445",

  // Cognito User Pool provider name used by Identity Pool
  userPoolProviderName:
    "cognito-idp.us-east-1.amazonaws.com/us-east-1_FSv9fcuXW",

  // IMPORTANT:
  // Replace this with the API URL from your current config.js
  // Example:
  // https://abc123.execute-api.us-east-1.amazonaws.com
  apiBaseUrl: "https://vl0ej1bup8.execute-api.us-east-1.amazonaws.com",

  refreshIntervalSeconds: 30
};