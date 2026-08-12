import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function dl(p){ const {data,error}=await s.storage.from('work-files').download(p); if(error) throw error; return new Uint8Array(await data.arrayBuffer()); }
const xlsxPath='6d3262dc-32c2-4910-b951-ccee79d82135/164b0baf-2b2c-4e34-bb62-906b8a232f87-Charlotte_Labs_Budget_DRAFT';
const docxPath='6d3262dc-32c2-4910-b951-ccee79d82135/4c9fd988-58d7-4969-b53b-17fe0ac29c4d-Lasso_Pilot_Terms_Summary.docx';
const pdfPath='6d3262dc-32c2-4910-b951-ccee79d82135/3f0a1ee9-3f6f-4199-8445-c716a2092dc2-03_Language_and_Positioning';
const XLSX = await import('xlsx');
const wb = XLSX.read(await dl(xlsxPath), {type:'array'});
console.log('SHEETS', wb.SheetNames);
console.log(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]).slice(0,200));
const mammoth = (await import('mammoth')).default;
const r = await mammoth.extractRawText({buffer: Buffer.from(await dl(docxPath))});
console.log('DOCX>>', r.value.slice(0,300));
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({data: await dl(pdfPath), useSystemFonts:false, isEvalSupported:false}).promise;
let out='';
for(let i=1;i<=Math.min(doc.numPages,2);i++){const p=await doc.getPage(i);const tc=await p.getTextContent();out+=tc.items.map(x=>x.str).join(' ')+'\n';}
console.log('PDF pages',doc.numPages,'>>',out.slice(0,300));
