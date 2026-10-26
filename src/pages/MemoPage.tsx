export const COPY = { title: "Memo" };

export function MemoPage({ token }: { token: string }) {
  return <main><h1>{COPY.title}</h1><p>{token.length}</p></main>;
}