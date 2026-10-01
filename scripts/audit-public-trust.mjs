import tls from 'node:tls';
import fs from 'node:fs/promises';

const origin = new URL(process.env.TRUST_AUDIT_ORIGIN || 'https://www.q-ai.online').origin;
const findings = [];
const pages = ['/', '/about', '/contact', '/legal/terms', '/legal/privacy', '/legal/refund', '/legal/accessibility', '/legal/subscription_terms'];
async function get(url, redirect='follow') {
  return fetch(url,{redirect,signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Q-Public-Trust-Check/1.0'}});
}
for (const pathname of pages) {
  try {
    const response = await get(origin+pathname);
    const html = await response.text();
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const resources = [...html.matchAll(/<(?:script|img|iframe|link|video|audio|source)\b[^>]*\b(?:src|href)=["'](http:\/\/[^"']+)/gi)].map(match=>match[1]);
    const expected = pathname === '/about' ? /<h1[^>]*>About Q Intelligence<\/h1>/ : pathname === '/contact' ? /<h1[^>]*>Contact Q Intelligence<\/h1>/ : /<h1[\s>]/;
    findings.push({check:pathname,pass:response.ok && expected.test(html) && !resources.length,status:response.status,title,mixedContentResources:resources});
    if (pathname === '/') for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["'](\/assets\/[^"']+)/gi)) {
      const asset = await get(origin+match[1]); findings.push({check:match[1],pass:asset.ok,status:asset.status});
    }
  } catch(error) { findings.push({check:pathname,pass:false,error:error.message}); }
}
for (const pathname of ['/robots.txt','/sitemap.xml']) {
  try { const response=await get(origin+pathname); const body=await response.text();
    findings.push({check:pathname,pass:response.ok && (pathname==='/robots.txt'?body.includes('Sitemap: '+origin+'/sitemap.xml'):body.includes('<urlset')),status:response.status});
  } catch(error) { findings.push({check:pathname,pass:false,error:error.message}); }
}
try { const response=await get(origin+'/not-a-real-page-trust-audit'); findings.push({check:'Unknown URL returns 404',pass:response.status===404,status:response.status}); } catch(error){findings.push({check:'404',pass:false,error:error.message});}
if (new URL(origin).protocol === 'https:') {
  for (const host of new Set([new URL(origin).hostname,new URL(origin).hostname.replace(/^www\./,'')])) {
    await new Promise(resolve=>{
      const socket=tls.connect({host,port:443,servername:host,rejectUnauthorized:true},()=>{
        const cert=socket.getPeerCertificate(); const daysRemaining=Math.floor((Date.parse(cert.valid_to)-Date.now())/86400000);
        findings.push({check:`TLS ${host}`,pass:socket.authorized && daysRemaining>14,issuer:cert.issuer?.CN,expires:cert.valid_to,daysRemaining});socket.end();resolve();
      });
      socket.setTimeout(15000,()=>{findings.push({check:`TLS ${host}`,pass:false,error:'timeout'});socket.destroy();resolve();});
      socket.once('error',error=>{findings.push({check:`TLS ${host}`,pass:false,error:error.message});resolve();});
    });
    try { let url=`http://${host}/`; const chain=[];
      for(let hop=0;hop<5;hop++){const response=await get(url,'manual');chain.push({url,status:response.status});const location=response.headers.get('location');if(!location)break;url=new URL(location,url).href;}
      const downgrade=chain.some((item,index)=>index>0 && new URL(chain[index-1].url).protocol==='https:' && new URL(item.url).protocol==='http:');
      findings.push({check:`HTTP redirect ${host}`,pass:!downgrade && chain.length>1 && chain.at(-1).status===200 && new URL(chain.at(-1).url).protocol==='https:',chain});
    }catch(error){findings.push({check:`HTTP redirect ${host}`,pass:false,error:error.message});}
  }
}
const report={checkedAt:new Date().toISOString(),origin,scope:'Public HTML, initial assets, redirects and TLS. Not a malware scan, Search Console integration or trust-score guarantee.',findings};
await fs.mkdir('artifacts',{recursive:true}); await fs.writeFile('artifacts/public-trust-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2)); if(findings.some(item=>!item.pass))process.exitCode=1;
