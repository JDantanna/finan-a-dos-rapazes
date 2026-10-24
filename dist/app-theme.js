'use strict';
const AppTheme=(()=>{
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const hex=values=>'#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
 const mix=(a,b,weight)=>hex(rgb(a).map((v,i)=>v*(1-weight)+rgb(b)[i]*weight));
 function luminance(color){const c=rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 function readable(color,background){let result=color;for(let i=0;i<30&&contrast(result,background)<4.8;i++)result=mix(result,'#000000',.12);return result;}
 function palette(value){
  const primary=/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():'#287560';
  const surface=mix(primary,'#ffffff',.99),bg=mix(primary,'#ffffff',.965),soft=mix(primary,'#ffffff',.90);
  const text=readable(primary,soft),ink=mix(primary,'#000000',.82),muted=readable(mix(primary,'#777777',.7),soft);
  const onPrimary=contrast(primary,'#ffffff')>=contrast(primary,'#000000')?'#ffffff':'#000000';
  return {'--accent':primary,'--accent-hover':mix(primary,onPrimary==='#ffffff'?'#000000':'#ffffff',.13),'--accent-contrast':onPrimary,'--green':text,'--mint':soft,'--bg':bg,'--white':surface,'--card':surface,'--ink':ink,'--muted':muted,'--line':mix(primary,'#ffffff',.77),'--surface-soft':mix(primary,'#ffffff',.95),'--surface-hover':mix(primary,'#ffffff',.85),'--focus':text,'--shadow':ink+'24','--backdrop':ink+'66','--chart-mid':mix(primary,'#ffffff',.3),'--chart-light':mix(primary,'#ffffff',.58),'--toast-bg':ink,'--toast-ink':'#ffffff'};
 }
 function apply(value,root=document.documentElement){const colors=palette(value);for(const [name,color] of Object.entries(colors))root.style.setProperty(name,color);return colors;}
 return {palette,apply,contrast};
})();
if(typeof document!=='undefined')AppTheme.apply('#287560');
if(typeof module!=='undefined')module.exports=AppTheme;
