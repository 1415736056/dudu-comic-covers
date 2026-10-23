import {drawBlink} from './blink-engine.js?v=20261023-1';
export const defaults = Object.freeze({ratio:'16:9',resolution:720,duration:12,fps:24,style:'breathe',strength:3,fit:'contain',positionX:50,positionY:50,glint:true,textEnabled:false,text:'链接简介自取',textPosition:'bottom',textSize:6,format:'auto',blinkEnabled:false,blinkInterval:3,blinkDuration:.28});
const choice = (v,list,fallback) => list.includes(v) ? v : fallback;
const number = (v,min,max,fallback) => Number.isFinite(Number(v)) ? Math.min(max,Math.max(min,Number(v))) : fallback;
export function normalize(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  return {ratio:choice(value.ratio,['16:9','9:16','1:1'],defaults.ratio),resolution:choice(Number(value.resolution),[720,1080],720),duration:Math.round(number(value.duration,3,30,12)),fps:choice(Number(value.fps),[24,30],24),style:choice(value.style,['breathe','push','pull','pan','still'],'breathe'),strength:number(value.strength,0,10,3),fit:choice(value.fit,['contain','cover'],'contain'),positionX:number(value.positionX,0,100,50),positionY:number(value.positionY,0,100,50),glint:typeof value.glint==='boolean'?value.glint:true,textEnabled:value.textEnabled===true,text:typeof value.text==='string'?value.text.slice(0,40):defaults.text,textPosition:choice(value.textPosition,['top','center','bottom'],'bottom'),textSize:choice(Number(value.textSize),[4,6,8],6),format:choice(value.format,['auto','mp4','webm'],'auto'),blinkEnabled:value.blinkEnabled===true,blinkInterval:number(value.blinkInterval,1,8,3),blinkDuration:number(value.blinkDuration,.12,.7,.28)};
}
export function dimensions(config) { const size=config.resolution; return config.ratio==='9:16'?[size,Math.round(size*16/9/2)*2]:config.ratio==='1:1'?[size,size]:[Math.round(size*16/9/2)*2,size]; }
export function render(canvas,image,config,seconds,blinkState=null,blinkOverride=null) {
  const ctx=canvas.getContext('2d',{alpha:false}),w=canvas.width,h=canvas.height;
  ctx.fillStyle='#111a2b';ctx.fillRect(0,0,w,h);
  if (!image) return;
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const p=Math.min(1,Math.max(0,seconds/config.duration)),ease=.5-.5*Math.cos(p*Math.PI),amount=config.strength/100;
  let base=(config.fit==='cover'?Math.max:Math.min)(w/iw,h/ih);
  if(config.fit==='contain'&&config.style!=='still')base/=1+amount*(config.style==='pan'?2:1);
  let zoom=1,dx=0;
  if(config.style==='breathe')zoom=1+amount*(.5-.5*Math.cos(p*2*Math.PI));
  if(config.style==='push')zoom=1+amount*ease;
  if(config.style==='pull')zoom=1+amount*(1-ease);
  if(config.style==='pan'){zoom=1+amount;dx=Math.sin(p*2*Math.PI)*w*amount*.45;}
  const dw=iw*base*zoom,dh=ih*base*zoom;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const placement={x:(w-dw)*config.positionX/100+dx,y:(h-dh)*config.positionY/100,w:dw,h:dh};
  ctx.drawImage(image,placement.x,placement.y,dw,dh);
  drawBlink(ctx,blinkState,config,seconds,placement,blinkOverride);
  if(config.glint){
    const sweep=(seconds%4)/4,x=-w*.7+sweep*w*2.5;
    ctx.save();ctx.globalCompositeOperation='screen';ctx.translate(x,0);ctx.rotate(-.3);
    const gradient=ctx.createLinearGradient(-w*.18,0,w*.18,0);gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.5,'rgba(255,255,255,0.13)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(-w*.18,-h,w*.36,h*3);ctx.restore();
  }
  if(config.textEnabled&&config.text.trim()){
    const size=Math.round(Math.min(w,h)*config.textSize/100),padding=size*.65;
    ctx.font=`800 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    const width=Math.min(w*.9,ctx.measureText(config.text).width+padding*2),boxHeight=size+padding;
    const cy=config.textPosition==='top'?h*.12:config.textPosition==='center'?h*.5:h*.87;
    ctx.fillStyle='rgba(10,18,30,.78)';ctx.fillRect((w-width)/2,cy-boxHeight/2,width,boxHeight);ctx.fillStyle='#fff179';ctx.fillText(config.text,w/2,cy,w*.86);
  }
}
