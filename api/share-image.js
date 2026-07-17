const sharp = require('sharp');

function clean(value, max = 240) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function xml(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function wrap(text, maxChars, maxLines) {
  const words = clean(text, 500).split(' '); const lines=[]; let line='';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line=word; if (lines.length === maxLines - 1) break; }
    else line=next;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.join(' ').length > lines.join(' ').length && lines.length) lines[lines.length-1] = `${lines[lines.length-1].replace(/[. ]+$/,'')}…`;
  return lines;
}
async function getTrail(slug) {
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,''); const key=String(process.env.SUPABASE_ANON_KEY||'').trim();
  if (!base||!key) return null;
  const url=`${base}/rest/v1/shared_trails?share_slug=eq.${encodeURIComponent(slug)}&is_public=eq.true&select=topic,summary&limit=1`;
  const response=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`}}); if(!response.ok)return null;
  const rows=await response.json(); return Array.isArray(rows)?rows[0]:null;
}
module.exports=async function handler(req,res){
  const slug=clean(req.query?.slug,40).toLowerCase(); const trail=/^[a-z0-9]{12,32}$/.test(slug)?await getTrail(slug):null;
  const topic=trail?.topic||'A shared RootedOS Truth Trail'; const summary=trail?.summary||'See the signal, pressure, formation, truth anchor, and next step.';
  const titleLines=wrap(topic,34,3); const summaryLines=wrap(summary,70,3);
  const titleSvg=titleLines.map((line,i)=>`<text x="110" y="${235+i*68}" font-family="Inter,Arial,sans-serif" font-size="58" font-weight="800" fill="#f4f1ea">${xml(line)}</text>`).join('');
  const summaryStart=255+titleLines.length*68;
  const summarySvg=summaryLines.map((line,i)=>`<text x="112" y="${summaryStart+i*34}" font-family="Inter,Arial,sans-serif" font-size="24" font-weight="400" fill="#bdb9b1">${xml(line)}</text>`).join('');
  const svg=`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="bg" cx="70%" cy="35%"><stop offset="0" stop-color="#182844"/><stop offset=".48" stop-color="#080b12"/><stop offset="1" stop-color="#020304"/></radialGradient><radialGradient id="orb" cx="35%" cy="25%"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".2" stop-color="#a8ddff" stop-opacity=".65"/><stop offset=".56" stop-color="#6b4dff" stop-opacity=".5"/><stop offset="1" stop-color="#020304" stop-opacity=".8"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="22"/></filter></defs><rect width="1200" height="630" fill="url(#bg)"/><circle cx="965" cy="205" r="155" fill="#5eb7ff" opacity=".14" filter="url(#glow)"/><circle cx="965" cy="205" r="118" fill="url(#orb)" stroke="#ffffff" stroke-opacity=".18"/><path d="M860 210 C920 178 1018 176 1070 218" fill="none" stroke="#ffd36b" stroke-width="9" opacity=".78" filter="url(#glow)"/><text x="110" y="105" font-family="Inter,Arial,sans-serif" font-size="25" font-weight="700" letter-spacing="4" fill="#ffd36b">ROOTEDOS · SHARED TRUTH TRAIL</text>${titleSvg}${summarySvg}<text x="110" y="575" font-family="Inter,Arial,sans-serif" font-size="20" fill="#8f8b84">Continue exploring at RootedOS</text></svg>`;
  const png=await sharp(Buffer.from(svg)).png().toBuffer(); res.setHeader('Content-Type','image/png'); res.setHeader('Cache-Control','public, max-age=300, s-maxage=86400'); return res.status(200).send(png);
};
