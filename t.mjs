import { Composio } from "@composio/core";
const c = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const uid = "1597a3ad-1f73-490b-a656-a5a71f124022";
const doc = "1NY5kgWu6feEIigUzLOxqZHoHhhjYx-plGodDRQBqcpw";
for (const args of [{file_id:doc, mime_type:"text/plain"}, {file_id:doc}]) {
  const p = await c.tools.execute("GOOGLEDRIVE_PARSE_FILE", { userId: uid, dangerouslySkipVersionCheck: true, arguments: args });
  console.log(JSON.stringify(args), p.successful, JSON.stringify(p.data).slice(0,400));
  if (p.successful && p.data?.file?.s3url) {
    const r = await fetch(p.data.file.s3url);
    const t = await r.text();
    console.log("bytes", t.length, JSON.stringify(t.slice(0,120)));
  }
}
