// Storybook runs in a browser only. The app's skin module imports TanStack Start's server half, which cannot be
// bundled here, so Storybook sees these stand-ins: the browser branch of an isomorphic function, and no cookies.
type Fn = (...args: never[]) => unknown;

export function createIsomorphicFn() {
  let client: Fn = () => undefined;
  const chain = {
    server: (_fn: Fn) => chain,
    client: (fn: Fn) => {
      client = fn;
      return Object.assign((...args: never[]) => client(...args), chain);
    },
  };
  return chain;
}

export function getCookie(_name: string): string | undefined {
  return undefined;
}

/**
 * Server functions and their middleware cannot run in Storybook. A story that renders a component which imports one
 * gets this stand-in: every builder step hands back the same chain, and calling the finished function refuses.
 * useServerFn hands a function straight back. Stories pass their own stand-in data and handlers as props instead.
 */
function serverChain(): unknown {
  const refuse = () => Promise.reject(new Error("Server functions do not run in Storybook."));
  return new Proxy(refuse, { get: (_target, key) => (key === "then" ? undefined : () => serverChain()) });
}

export const createServerFn = (): unknown => serverChain();
export const createMiddleware = (): unknown => serverChain();
export const createCsrfMiddleware = (): unknown => serverChain();
export const createStart = (): unknown => serverChain();
export const getRequest = (): undefined => undefined;
export const getRequestHeader = (_name: string): undefined => undefined;

export function useServerFn<T>(fn: T): T {
  return fn;
}
