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

    // ── DynamoDB: Users ──────────────────────────────────────────────────────
    //
    // Access patterns:
    //   - Get user by immutable UUID  → PK: USER#<id>,    SK: #META
    //   - Get user by email (auth)    → GSI1 PK: EMAIL#<email>

    const usersTable = new sst.aws.Dynamo('UsersTable', {
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

    // ── Cognito ──────────────────────────────────────────────────────────────
    //
    // PostConfirmation trigger fires after email verification and creates the
    // DynamoDB user record with an immutable UUID. Admin status is managed
    // entirely in DynamoDB — no Cognito groups are used for authorization.

    const userPool = new sst.aws.CognitoUserPool('UserPool', {
      usernames: ['email'],
      triggers: {
        postConfirmation: {
          handler: 'functions/cognito-post-confirmation.handler',
          link: [usersTable],
        },
      },
    });

    const client = userPool.addClient('WebClient');

    const identityPool = new sst.aws.CognitoIdentityPool('IdentityPool', {
      userPools: [{ userPool: userPool.id, client: client.id }],
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

    // ── User API (Cognito JWT authenticated) ─────────────────────────────────
    //
    // Every route uses the withAuth HOC which verifies the Cognito ID token,
    // looks up the user by email in DynamoDB, and passes the full user record
    // to the handler. Admin/role checks are performed against DynamoDB fields.

    const userApi = new sst.aws.ApiGatewayV2('UserApi', {
      cors: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    userApi.route('GET /me', {
      handler: 'functions/user-me.handler',
      link: [usersTable, userPool, client],
    });

    userApi.route('GET /admin/users', {
      handler: 'functions/admin-get-users.handler',
      link: [usersTable, userPool, client],
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
        VITE_USER_API_URL: userApi.url,
      },
    });

    return {
      SiteUrl: site.url,
      IngestApiUrl: ingestApi.url,
      UserApiUrl: userApi.url,
    };
  },
});
