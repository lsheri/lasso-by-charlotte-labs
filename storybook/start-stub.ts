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
