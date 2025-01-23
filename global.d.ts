// global.d.ts
declare interface Window {
  __reactRouterContext?: {
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