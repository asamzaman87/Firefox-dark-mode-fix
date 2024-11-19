// global.d.ts
declare interface Window {
  __remixContext?: {
    state: {
      loaderData: {
        root: {
          clientBootstrap: {
            session: {
              accessToken: string;
            };
          };
        };
      };
    };
  };
}