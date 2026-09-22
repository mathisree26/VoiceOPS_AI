# VoiceOps Frontend

The dashboard now loads service health from the backend's `GET /services` endpoint. There is no hard-coded service health data in the frontend.

Configure `config.js` with:

- `region`
- `identityPoolId` from the frontend CloudFormation stack
- `apiBaseUrl` from the backend CloudFormation stack

Then:

```bash
npm ci
npm run build
```

Upload `index.html`, `styles.css`, `config.js`, and `bundle.js` to the frontend S3 bucket and invalidate CloudFront.

For the full infrastructure sequence, use the repository-level `README.md` or `scripts/deploy.sh`.
