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
    // Cognito User Pool
    const userPool = new sst.aws.CognitoUserPool('UserPool', {
      usernames: ['email'], // Allow email sign-in
    });

    // Add a client for your frontend
    const client = userPool.addClient('WebClient');

    // Cognito Identity Pool
    const identityPool = new sst.aws.CognitoIdentityPool('IdentityPool', {
      userPools: [{ userPool: userPool.id, client: client.id }], // Link user pool and client
    });

    // Your existing Vite frontend
    const site = new sst.aws.StaticSite('Site', {
      path: '.', // Root where vite.config.ts is
      build: {
        command: 'npm run build',
        output: 'dist',
      },
      dev: {
        command: 'vite --host',
      },
      environment: {
        VITE_USER_POOL_ID: userPool.id, // Inject for frontend
        VITE_IDENTITY_POOL_ID: identityPool.id,
        VITE_USER_POOL_CLIENT_ID: client.id,
      },
    });

    return {
      SiteUrl: site.url,
    };
  },
});
