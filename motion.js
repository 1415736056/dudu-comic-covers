import { defaults, normalize, dimensions, render } from './motion-renderer.js?v=20261021-1';

const $=id=>document.getElementById(id),storageKey='dudu-motion-config-v1';
let config={...defaults},queue=[],active=null,image=null,playing=false,started=0,current=0,busy=false,cancelled=false,library=[],results=[],selectToken=0,bunnyPromise;
try{config=normalize(JSON.parse(localStorage.getItem(storageKey)||'null')||defaults);}catch{}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeName=value=>String(value).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,90)||'动态封面';
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function paint(){render($('preview'),image,config,current);$('seek').value=current;$('time').textContent=`${current.toFixed(1)} / ${config.duration} 秒`;}
function pause(){playing=false;$('play').textContent='▶';$('play').setAttribute('aria-label','播放预览');}
function play(){if(!image||busy)return;playing=true;started=performance.now()-current*1000;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暂停预览');requestAnimationFrame(tick);}
function tick(now){if(!playing||busy)return;current=((now-started)/1000)%config.duration;paint();requestAnimationFrame(tick);}
function syncForm(){for(const key of Object.keys(defaults)){const el=$(key);if(el.type==='checkbox')el.checked=config[key];else el.value=config[key];}for(const key of ['strength','positionX','positionY'])$(key+'-value').textContent=config[key]+'%';$('seek').max=config.duration;const [w,h]=dimensions(config);$('preview').width=w;$('preview').height=h;$('preview').style.aspectRatio=`${w}/${h}`;current=Math.min(current,config.duration);paint();}
function saveLocal(){try{localStorage.setItem(storageKey,JSON.stringify(config));}catch{}}
function readForm(){const value={};for(const key of Object.keys(defaults)){const el=$(key);value[key]=el.type==='checkbox'?el.checked:el.value;}config=normalize(value);saveLocal();syncForm();detectFormats();}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function refreshQueue(){
  $('queue-count').textContent=`${queue.length} / 20 张图片`;
  $('queue').innerHTML=queue.map(q=>`<div class="queue-item"><button class="select-image" data-select="${escape(q.id)}" aria-pressed="${active?.id===q.id}" title="${escape(q.name)}" aria-label="预览${escape(q.name)}"><img src="${escape(q.thumb||q.src)}" alt=""></button><button class="remove" data-remove="${escape(q.id)}" aria-label="移除${escape(q.name)}">×</button></div>`).join('');
  $('export-all').hidden=queue.length<2;$('export').disabled=busy||!image;$('export-all').disabled=busy||!image;$('play').disabled=busy||!image;
}
async function decode(src){const img=new Image();img.decoding='async';img.src=src;await img.decode();if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>50000000)throw new Error('图片尺寸过大，请先缩小到 5000 万像素以内。');return img;}
async function select(q){
  pause();const token=++selectToken;active=q;image=null;current=0;refreshQueue();$('loading').hidden=false;$('loading').textContent='正在载入图片…';$('source-name').textContent=q.name;$('source-size').textContent='';
  try{const img=await decode(q.src);if(token!==selectToken)return;image=img;$('loading').hidden=true;$('source-size').textContent=`${img.naturalWidth} × ${img.naturalHeight}`;paint();refreshQueue();}
  catch(err){if(token!==selectToken)return;$('loading').textContent='图片载入失败，请重新选择';message(err.message||'图片载入失败，请重新选择。',true);refreshQueue();}
}
function addLibrary(id){const item=library.find(x=>String(x.id)===String(id));if(!item)return;const existing=queue.find(x=>x.id===`cover-${item.id}`);if(existing){select(existing);return;}if(queue.length>=20){message('每组最多 20 张，请先移除部分图片。',true);return;}const q={id:`cover-${item.id}`,name:item.work,src:item.cover,thumb:item.preview};queue.push(q);select(q);}
function remove(q){if(q.local)URL.revokeObjectURL(q.src);queue=queue.filter(x=>x!==q);if(active===q){if(queue.length)select(queue[0]);else{++selectToken;pause();active=null;image=null;$('loading').hidden=false;$('loading').textContent='选择封面或上传图片开始制作';$('source-name').textContent='尚未选择图片';$('source-size').textContent='';paint();}}refreshQueue();}
const bunny=()=>bunnyPromise||(bunnyPromise=import('./vendor/mediabunny-1.62.0.min.mjs'));
function recorderType(format){if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)return null;const types=format==='mp4'?['video/mp4;codecs=avc1.42E01E','video/mp4']:['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];return types.find(t=>MediaRecorder.isTypeSupported(t))||null;}
async function encoder(format,cfg){
  const [width,height]=dimensions(cfg);
  try{const b=await bunny();const codec=format==='mp4'?'avc':'vp9';if(await b.canEncodeVideo(codec,{width,height,frameRate:cfg.fps,quality:new b.Quality('high')}))return{kind:'frames',format,codec,b};}catch{}
  const mime=recorderType(format);return mime?{kind:'record',format,mime}:null;
}
let detectId=0;
async function detectFormats(){const id=++detectId;const cfg={...config};$('capability').textContent='正在检测此配置可导出的视频格式…';const [mp4,webm]=await Promise.all([encoder('mp4',cfg),encoder('webm',cfg)]);if(id!==detectId)return;for(const option of $('format').options){if(option.value==='mp4')option.disabled=!mp4;if(option.value==='webm')option.disabled=!webm;}$('capability').textContent=mp4?'此浏览器支持 MP4。视频在本机生成，请保持页面在前台。':webm?'此浏览器可导出 WebM，暂不支持 MP4。可用电脑 Edge / Chrome 再试。':'此浏览器暂不支持视频导出，请换用最新版 Edge / Chrome / Safari。';}
function setBusy(value){busy=value;$('image-controls').disabled=value;$('config-controls').disabled=value;$('play').disabled=value||!image;$('seek').disabled=value;$('export').disabled=value||!image;$('export-all').disabled=value||!image;$('cancel').hidden=!value;$('progress-box').hidden=!value;if(value)pause();refreshQueue();}
function report(progress,text){$('progress').value=progress;$('progress-text').textContent=text;}
async function encodeFrames(canvas,img,cfg,mode,onProgress){
  const {Output,Mp4OutputFormat,WebMOutputFormat,BufferTarget,CanvasSource,Quality}=mode.b;
  const target=new BufferTarget(),output=new Output({format:mode.format==='mp4'?new Mp4OutputFormat({fastStart:'in-memory'}):new WebMOutputFormat(),target});
  const source=new CanvasSource(canvas,{codec:mode.codec,quality:new Quality('high'),keyFrameInterval:2});output.addVideoTrack(source,{frameRate:cfg.fps});
  try{await output.start();const frames=Math.round(cfg.duration*cfg.fps);for(let i=0;i<frames;i++){if(cancelled)throw new DOMException('已停止','AbortError');render(canvas,img,cfg,i/cfg.fps);await source.add(i/cfg.fps,1/cfg.fps);if(i%4===0){onProgress((i+1)/frames);await new Promise(resolve=>setTimeout(resolve,0));}}source.close();await output.finalize();return new Blob([target.buffer],{type:mode.format==='mp4'?'video/mp4':'video/webm'});}catch(err){try{await output.cancel();}catch{}throw err;}
}
async function encodeRecording(canvas,img,cfg,mode,onProgress){
  render(canvas,img,cfg,0);const stream=canvas.captureStream(cfg.fps);let recorder,raf;
  try{return await new Promise((resolve,reject)=>{const chunks=[];recorder=new MediaRecorder(stream,{mimeType:mode.mime,videoBitsPerSecond:cfg.resolution===1080?10000000:5000000});let failure=null,start;
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>{failure=e.error||new Error('浏览器录制失败');if(recorder.state!=='inactive')recorder.stop();else reject(failure);};recorder.onstop=()=>{cancelAnimationFrame(raf);if(failure)reject(failure);else if(cancelled)reject(new DOMException('已停止','AbortError'));else if(!chunks.length)reject(new Error('未生成视频数据，请更换浏览器重试。'));else resolve(new Blob(chunks,{type:recorder.mimeType}));};
    recorder.start(300);start=performance.now();const step=now=>{if(recorder.state==='inactive')return;if(cancelled){recorder.stop();return;}if(document.hidden){failure=new Error('录制时页面进入了后台，请保持页面在前台后重试。');recorder.stop();return;}const t=(now-start)/1000;render(canvas,img,cfg,Math.min(t,cfg.duration));onProgress(Math.min(1,t/cfg.duration));if(t>=cfg.duration)recorder.stop();else raf=requestAnimationFrame(step);};raf=requestAnimationFrame(step);
  });}finally{cancelAnimationFrame(raf);if(recorder&&recorder.state!=='inactive')recorder.stop();for(const track of stream.getTracks())track.stop();}
}
function showResults(){
  $('results-section').hidden=results.length===0;$('download-all').hidden=results.length<2;
  $('results').innerHTML=results.map(r=>`<li class="result"><div><strong>${escape(r.name)}</strong><small>${r.cfg.duration} 秒 · ${r.width} × ${r.height} · ${(r.blob.size/1048576).toFixed(1)} MB</small></div><nav><a href="${r.url}" target="_blank" rel="noopener">播放</a><a href="${r.url}" download="${escape(r.name)}">下载视频</a></nav></li>`).join('');
}
async function generate(all){
  if(busy||!image)return;const tasks=all?[...queue]:[active],cfg={...config};cancelled=false;setBusy(true);message('');report(0,'正在准备导出…');let wake;
  try{
    try{wake=await navigator.wakeLock?.request('screen');}catch{}
    let mode=cfg.format==='auto'?(await encoder('mp4',cfg)||await encoder('webm',cfg)):await encoder(cfg.format,cfg);
    if(!mode)throw new Error('此配置没有可用的编码器。请尝试 720p、24 帧或更换浏览器。');
    for(const previous of results)URL.revokeObjectURL(previous.url);results=[];showResults();
    const canvas=document.createElement('canvas');const [w,h]=dimensions(cfg);canvas.width=w;canvas.height=h;
    for(let index=0;index<tasks.length;index++){
      if(cancelled)throw new DOMException('已停止','AbortError');const task=tasks[index],img=task===active?image:await decode(task.src);
      const progress=p=>report(Math.round((index+p)/tasks.length*100),`${index+1} / ${tasks.length} · ${task.name} · ${Math.round(p*100)}%${mode.kind==='record'?'（实时录制）':''}`);
      let blob;
      try{blob=await(mode.kind==='frames'?encodeFrames:encodeRecording)(canvas,img,cfg,mode,progress);}catch(err){const mime=mode.kind==='frames'&&!cancelled?recorderType(mode.format):null;if(!mime)throw err;mode={kind:'record',format:mode.format,mime};message('正在使用浏览器实时录制，请保持页面在前台。');blob=await encodeRecording(canvas,img,cfg,mode,progress);}
      const name=`${safeName(task.name)}_${cfg.ratio.replace(':','x')}_${cfg.duration}秒.${mode.format}`;
      results.push({blob,name,cfg,width:w,height:h,url:URL.createObjectURL(blob)});showResults();
    }
    report(100,'生成完成');message(`已生成 ${results.length} 个视频，点击下方“下载视频”保存${results.length>1?'，或打包下载 ZIP':''}。`);
  }catch(err){message(err.name==='AbortError'?`已停止。已完成的 ${results.length} 个视频仍可下载。`:err.message||'生成失败，请尝试 720p 后重试。',err.name!=='AbortError');}
  finally{try{await wake?.release();}catch{}setBusy(false);paint();}
}

// ZIP uses the store method: the videos are already compressed. UTF-8 names are preserved.
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
async function zipResults(){
  const parts=[],central=[];let offset=0;const text=new TextEncoder();
  for(let i=0;i<results.length;i++){
    const result=results[i],name=text.encode(`${String(i+1).padStart(2,'0')}_${result.name}`),data=new Uint8Array(await result.blob.arrayBuffer());let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
    const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);parts.push(local,result.blob);
    const entry=new Uint8Array(46+name.length),ev=new DataView(entry.buffer);ev.setUint32(0,0x02014b50,true);ev.setUint16(4,20,true);ev.setUint16(6,20,true);ev.setUint16(8,0x800,true);ev.setUint16(14,33,true);ev.setUint32(16,crc,true);ev.setUint32(20,data.length,true);ev.setUint32(24,data.length,true);ev.setUint16(28,name.length,true);ev.setUint32(42,offset,true);entry.set(name,46);central.push(entry);offset+=local.length+data.length;
  }
  const size=central.reduce((sum,p)=>sum+p.length,0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,results.length,true);end.setUint16(10,results.length,true);end.setUint32(12,size,true);end.setUint32(16,offset,true);
  return new Blob([...parts,...central,end.buffer],{type:'application/zip'});
}

$('play').onclick=()=>playing?pause():play();$('seek').oninput=()=>{pause();current=Number($('seek').value);paint();};
$('config-controls').addEventListener('input',e=>{if(Object.hasOwn(defaults,e.target.id))readForm();});
$('library').onchange=()=>{if($('library').value)addLibrary($('library').value);};$('add-library').onclick=()=>addLibrary($('library').value);
$('queue').onclick=e=>{if(busy)return;const selector=e.target.closest('[data-select]'),remover=e.target.closest('[data-remove]');if(selector){const q=queue.find(x=>x.id===selector.dataset.select);if(q)select(q);}if(remover){const q=queue.find(x=>x.id===remover.dataset.remove);if(q)remove(q);}};
$('clear-queue').onclick=()=>{if(busy)return;for(const q of [...queue])remove(q);message('已清空。选择封面或上传自己的图片。');};
$('upload').onchange=async e=>{
  const files=[...e.target.files];e.target.value='';if(!files.length)return;message('');const rejected=[];let first;
  for(const file of files){if(queue.length>=20){rejected.push('每组最多 20 张');break;}if(!/\.(png|jpe?g|webp|avif)$/i.test(file.name)||file.size>30*1024*1024){rejected.push(`${file.name}：请选择 30 MB 以内的 PNG / JPG / WebP / AVIF`);continue;}const src=URL.createObjectURL(file),q={id:`local-${crypto.randomUUID()}`,name:file.name.replace(/\.[^.]+$/,''),src,local:true};queue.push(q);first||=q;}
  refreshQueue();if(first)await select(first);if(rejected.length)message(rejected.join('；'),true);
};
$('reset').onclick=()=>{config={...defaults};saveLocal();syncForm();detectFormats();message('已恢复默认配置。');};
$('save-config').onclick=()=>download(new Blob([JSON.stringify({schema:'dudu-motion',version:1,settings:config},null,2)],{type:'application/json'}),'嘟嘟动态封面配置.json');
$('import-config').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>100000)throw new Error('配置文件过大');const parsed=JSON.parse(await file.text());if(parsed.schema!=='dudu-motion'||parsed.version!==1||!parsed.settings||typeof parsed.settings!=='object')throw new Error('配置格式不正确');config=normalize(parsed.settings);saveLocal();syncForm();detectFormats();message('配置已导入，图片请在当前设备重新选择。');}catch(err){message(`无法导入：${err.message}。请选择本页保存的配置文件。`,true);}};
$('export').onclick=()=>generate(false);$('export-all').onclick=()=>generate(true);$('cancel').onclick=()=>{cancelled=true;$('progress-text').textContent='正在停止，已完成的视频会保留…';};
$('download-all').onclick=async()=>{const button=$('download-all');button.disabled=true;try{message('正在打包视频…');download(await zipResults(),'嘟嘟动态封面视频.zip');message('打包完成。');}catch(err){message('打包失败，请分别下载视频。',true);}finally{button.disabled=false;}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
syncForm();detectFormats();
fetch('data.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{library=data;$('library').innerHTML='<option value="">选择漫画封面…</option>'+library.map(item=>`<option value="${item.id}">${escape(item.work)}</option>`).join('');$('add-library').disabled=false;const id=new URLSearchParams(location.search).get('cover')||'3';if(library.some(item=>String(item.id)===id)){$('library').value=id;addLibrary(id);}else{$('loading').textContent='选择封面或上传图片开始制作';}}).catch(()=>{$('library').innerHTML='<option value="">封面库暂时无法载入</option>';$('loading').textContent='可上传自己的图片开始制作';message('封面库载入失败，仍可使用本地图片。',true);});
