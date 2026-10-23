const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function normalizeRegions(value){
  if(!Array.isArray(value))return [];
  return value.slice(0,12).flatMap(r=>{
    if(!r||typeof r!=='object'||![r.x,r.y,r.w,r.h].every(Number.isFinite))return [];
    const x=clamp(r.x,0,.998),y=clamp(r.y,0,.998),w=clamp(r.w,0,1-x),h=clamp(r.h,0,1-y);
    return w>=.002&&h>=.002?[{x,y,w,h,angle:Number.isFinite(r.angle)?clamp(r.angle,-80,80):0}]:[];
  });
}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export function blinkAmount(seconds,interval=3,duration=.28){
  const first=Math.min(1.2,interval*.4),phase=((seconds-first+interval/2)%interval+interval)%interval-interval/2;
  if(Math.abs(phase)>=duration/2)return 0;
  const p=(phase+duration/2)/duration;
  return Math.sin(Math.PI*p)**1.2;
}
function fillEyelid(skin,original){
  const w=skin.width,h=skin.height,ctx=original.getContext('2d'),data=ctx.getImageData(0,0,w,h).data;
  const luminance=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
  const pixel=(x,y)=>{const i=(y*w+x)*4;return [data[i],data[i+1],data[i+2]];};
  const color=points=>{points.sort((a,b)=>luminance(a)-luminance(b));const middle=Math.floor(points.length*.72),slice=points.slice(Math.max(0,middle-2),middle+3);return [0,1,2].map(i=>slice.reduce((sum,c)=>sum+c[i],0)/Math.max(1,slice.length));};
  const border=[];for(let x=0;x<w;x++){border.push(pixel(x,0),pixel(x,h-1));}for(let y=0;y<h;y++){border.push(pixel(0,y),pixel(w-1,y));}
  const base=color(border);
  const corner=(left,top)=>{const points=[];for(let x=left?0:Math.floor(w*.6);x<(left?Math.ceil(w*.4):w);x++)for(let y=top?0:Math.max(0,h-3);y<(top?Math.min(3,h):h);y++)points.push(pixel(x,y));const c=color(points);return luminance(c)<luminance(base)*.7?base:c;};
  const corners=[corner(true,true),corner(false,true),corner(true,false),corner(false,false)],out=skin.getContext('2d').createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/Math.max(1,w-1),v=y/Math.max(1,h-1),i=(y*w+x)*4;for(let k=0;k<3;k++)out.data[i+k]=(corners[0][k]*(1-u)+corners[1][k]*u)*(1-v)+(corners[2][k]*(1-u)+corners[3][k]*u)*v;out.data[i+3]=255;}
  skin.getContext('2d').putImageData(out,0,0);
}
export function prepareBlink(image,regions,closedImage=null){
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const normalized=normalizeRegions(regions);
  return {regions:normalized,patches:normalized.map(region=>{
    const sx=region.x*iw,sy=region.y*ih,sw=region.w*iw,sh=region.h*ih;
    const scale=Math.min(1,512/sw,256/sh),w=Math.max(4,Math.round(sw*scale)),h=Math.max(4,Math.round(sh*scale));
    const original=canvas(w,h),context=original.getContext('2d',{willReadFrequently:true});context.drawImage(image,sx,sy,sw,sh,0,0,w,h);
    const scratch=canvas(w,h),mask=canvas(w,h),skin=canvas(w,h),maskContext=mask.getContext('2d'),pixels=maskContext.createImageData(w,h),feather=Math.max(1,Math.min(w,h)*.17);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;pixels.data[i+3]=Math.round(255*clamp(Math.min(x+1,w-x,y+1,h-y)/feather,0,1));}maskContext.putImageData(pixels,0,0);
    let closed=null;
    if(closedImage){closed=canvas(w,h);const cw=closedImage.naturalWidth||closedImage.width,ch=closedImage.naturalHeight||closedImage.height;closed.getContext('2d').drawImage(closedImage,region.x*cw,region.y*ch,region.w*cw,region.h*ch,0,0,w,h);}
    fillEyelid(skin,original);
    const data=context.getImageData(0,0,w,h).data,colors=[];
    for(let y=Math.floor(h*.2);y<Math.ceil(h*.8);y++)for(let x=Math.floor(w*.1);x<Math.ceil(w*.9);x++){const i=(y*w+x)*4;colors.push([data[i],data[i+1],data[i+2]]);}
    colors.sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));const color=colors[Math.floor(colors.length*.12)]||[35,28,28];
    return {region,original,closed,scratch,mask,skin,w,h,color:`rgb(${color.join(',')})`};
  })};
}
export function drawBlink(ctx,state,config,seconds,placement,override=null){
  if(!config.blinkEnabled||!state?.patches.length)return;
  const amount=override===null?blinkAmount(seconds,config.blinkInterval,config.blinkDuration):clamp(override,0,1);
  if(amount<.001)return;
  for(const patch of state.patches){
    const {w,h,original,closed,scratch,skin,mask,region}=patch,c=scratch.getContext('2d');
    c.clearRect(0,0,w,h);c.globalCompositeOperation='source-over';c.globalAlpha=1;
    if(closed){c.drawImage(closed,0,0);c.globalAlpha=1-amount;c.drawImage(original,0,0);c.globalAlpha=1;}
    else{
      c.drawImage(skin,0,0);const height=Math.max(1,h*(1-amount*.985));if(amount<.985){c.globalAlpha=Math.min(1,(1-amount)*8);c.drawImage(original,0,(h-height)/2,w,height);c.globalAlpha=1;}
      if(amount>.8){c.globalAlpha=(amount-.8)*5;c.strokeStyle=patch.color;c.lineWidth=Math.max(1,h*.045);c.lineCap='round';const angle=region.angle*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),radius=Math.min(w*.4/Math.max(.01,Math.abs(cos)),h*.28/Math.max(.01,Math.abs(sin)));c.beginPath();c.moveTo(w*.5-radius*cos,h*.5-radius*sin);c.quadraticCurveTo(w*.5-sin*h*.12,h*.5+cos*h*.12,w*.5+radius*cos,h*.5+radius*sin);c.stroke();c.globalAlpha=1;}
    }
    c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);c.globalCompositeOperation='source-over';
    ctx.drawImage(scratch,placement.x+region.x*placement.w,placement.y+region.y*placement.h,region.w*placement.w,region.h*placement.h);
  }
}
