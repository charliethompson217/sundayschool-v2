/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'sundayschool-v2',
      region: 'us-east-1',
      home: 'aws',
    };
  },
  async run() {
    // ── Secrets ──────────────────────────────────────────────────────────────

    const espnWebhookSecret = new sst.Secret('EspnWebhookSecret');

    // ── Cognito ──────────────────────────────────────────────────────────────

    const userPool = new sst.aws.CognitoUserPool('UserPool', {
      usernames: ['email'],
    });

    const client = userPool.addClient('WebClient');

    const identityPool = new sst.aws.CognitoIdentityPool('IdentityPool', {
      userPools: [{ userPool: userPool.id, client: client.id }],
    });

    // Admin group for future admin endpoints (JWT group claim)
    new aws.cognito.UserGroup('AdminGroup', {
      name: 'admin',
      userPoolId: userPool.id,
      description: 'Pool administrators',
    });

    // ── DynamoDB: ESPN raw game data ─────────────────────────────────────────

    const espnGames = new sst.aws.Dynamo('EspnGames', {
      fields: {
        pk: 'string',
        sk: 'string',
        gsi1pk: 'string',
        gsi1sk: 'string',
      },
      primaryIndex: { hashKey: 'pk', rangeKey: 'sk' },
      globalIndexes: {
        gsi1: { hashKey: 'gsi1pk', rangeKey: 'gsi1sk' },
      },
    });

    // ── Internal ingest API (machine-to-machine only) ────────────────────────

    const ingestApi = new sst.aws.ApiGatewayV2('IngestApi');

    ingestApi.route('POST /internal/espn-ingest', {
      handler: 'functions/espn-ingest.handler',
      link: [espnGames, espnWebhookSecret],
    });

    // ── Static site (frontend) ───────────────────────────────────────────────

    const site = new sst.aws.StaticSite('Site', {
      path: '.',
      build: {
        command: 'npm run build',
        output: 'dist',
      },
      dev: {
        command: 'vite --host',
      },
      environment: {
        VITE_USER_POOL_ID: userPool.id,
        VITE_IDENTITY_POOL_ID: identityPool.id,
        VITE_USER_POOL_CLIENT_ID: client.id,
      },
    });

    return {
      SiteUrl: site.url,
      IngestApiUrl: ingestApi.url,
    };
  },
});
