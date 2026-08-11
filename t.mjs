import { Composio } from "@composio/core";
const c = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const uid = "1597a3ad-1f73-490b-a656-a5a71f124022";
const r = await c.tools.execute("GOOGLEDRIVE_LIST_FILES", { userId: uid, dangerouslySkipVersionCheck: true, arguments: { fields: "nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,size)", orderBy: "modifiedTime desc", pageSize: 5, q: "trashed = false" } });
console.log(r.successful, JSON.stringify(r.data).slice(0, 1500));
const f = (r.data?.files ?? [])[0];
if (f) {
  const p = await c.tools.execute("GOOGLEDRIVE_PARSE_FILE", { userId: uid, dangerouslySkipVersionCheck: true, arguments: { file_id: f.id } });
  console.log("parse", p.successful, JSON.stringify(p.data).slice(0,800), p.error);
}
