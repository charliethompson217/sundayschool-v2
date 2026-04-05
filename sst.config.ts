/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'sundayschool-v2',
      region: 'us-east-2',
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
          handler: 'functions/triggers/cognito-post-confirmation.handler',
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

    // ── DynamoDB: App schedule / lineup config ─────────────────────────────
    //
    // Stores app-owned weekly schedule configuration, separate from raw ESPN data.
    //
    // Item types:
    //   PK: SEASON#<year>#TYPE#<seasonType>#WEEK#<week>, SK: META
    //     - week-level settings / visibility / submission windows
    //
    //   PK: SEASON#<year>#TYPE#<seasonType>#WEEK#<week>, SK: GAME#<order>#<gameId>
    //     - one configured game entry for the week
    //
    // GSI1:
    //   - season overview of week META items
    //   PK: SEASON#<year>#TYPE#<seasonType>
    //   SK: WEEK#<week>#META

    const schedulesTable = new sst.aws.Dynamo('SchedulesTable', {
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
      handler: 'functions/routes/espn/espn-ingest.handler',
      link: [espnGames, espnWebhookSecret, schedulesTable],
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
      handler: 'functions/routes/users/user-me.handler',
      link: [usersTable, userPool, client],
    });

    userApi.route('GET /admin/users', {
      handler: 'functions/routes/admin/users-get.handler',
      link: [usersTable, userPool, client],
    });

    userApi.route('GET /schedules', {
      handler: 'functions/routes/schedules/schedules-list.handler',
      link: [schedulesTable, usersTable, userPool, client],
    });

    userApi.route('GET /schedules/{year}/{seasonType}/{week}', {
      handler: 'functions/routes/schedules/schedules-get.handler',
      link: [schedulesTable, espnGames, usersTable, userPool, client],
    });

    userApi.route('POST /admin/schedules/{year}/{seasonType}/{week}', {
      handler: 'functions/routes/admin/schedules-insert.handler',
      link: [schedulesTable, espnGames, usersTable, userPool, client],
    });

    userApi.route('PUT /admin/schedules/{year}/{seasonType}/{week}', {
      handler: 'functions/routes/admin/schedules-update.handler',
      link: [schedulesTable, espnGames, usersTable, userPool, client],
    });

    // ── Public games API (no auth) ───────────────────────────────────────────
    //
    // Read-only. Supports:
    //   GET /espn/games/{gameId}           — single game lookup via GSI
    //   GET /espn/games?year=              — all games for a year
    //   GET /espn/games?year=&seasonType=  — all games for a season type
    //   GET /espn/games?year=&seasonType=&week= — all games for a specific week

    const gamesApi = new sst.aws.ApiGatewayV2('GamesApi', {
      cors: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      },
    });

    gamesApi.route('GET /espn/games', {
      handler: 'functions/routes/espn/espn-get.listHandler',
      link: [espnGames],
    });

    gamesApi.route('GET /espn/games/{gameId}', {
      handler: 'functions/routes/espn/espn-get.getHandler',
      link: [espnGames],
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
        VITE_ESPN_API_URL: gamesApi.url,
      },
    });

    return {
      SiteUrl: site.url,
      IngestApiUrl: ingestApi.url,
      UserApiUrl: userApi.url,
      GamesApiUrl: gamesApi.url,
    };
  },
});
