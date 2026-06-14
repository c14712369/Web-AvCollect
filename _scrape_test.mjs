import * as cheerio from 'cheerio';
const url = "https://www.javrate.com/Movie/Detail/1b464cf5-3ebd-406a-8d41-a5961a2870ca.html";
const H = { 'User-Agent':'Mozilla/5.0 ... Chrome/120 Safari/537.36','Accept-Language':'zh-TW,zh;q=0.9' };
async function direct(u){const r=await fetch(u,{headers:{...H,Referer:u}});return{html:await r.text(),status:r.status};}
async function jina(u){const r=await fetch(`https://r.jina.ai/${u}`,{headers:{...H,'X-Return-Format':'html'}});return{html:await r.text(),status:r.status};}
const pT=$=>$('meta[property="og:title"]').attr('content')||$('title').text()||'Unknown';
const blocked=(s,t)=>s===403||/Attention Required|Just a moment|you have been blocked/i.test(t);
function upgrade(u){return u.replace('_thumbnail.webp','.webp');}

let {html,status}=await direct(url); let $=cheerio.load(html); let title=pT($);
console.log('[direct] status', status, '| blocked?', blocked(status,title));
if(blocked(status,title)){ ({html,status}=await jina(url)); $=cheerio.load(html); title=pT($); console.log('[jina] status', status, '| blocked?', blocked(status,title)); }

let imageUrl=$('meta[property="og:image"]').attr('content')||'';
const codeRegex=/[a-z0-9]+(?:-[a-z0-9]+)+/i;
const m=title.match(codeRegex);
console.log('\n=== RESULT ===');
console.log('code :', m?m[0].toUpperCase():'UNKNOWN');
console.log('title:', title.slice(0,70));
console.log('image:', upgrade(imageUrl));
