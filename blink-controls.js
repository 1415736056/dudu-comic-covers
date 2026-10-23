import {prepareBlink,normalizeRegions} from './blink-engine.js?v=20261023-1';
import {createEyeEditor} from './eye-editor.js?v=20261023-1';
const $=id=>document.getElementById(id);
export function createBlinkControls({getActive,getImage,getConfig,onChange,pause,message}){
  let forced=null,pending=null;
  function invalidate(q){delete q.blinkState;delete q.blinkSignature;forced=null;}
  function refresh(busy=false){
    const q=getActive(),image=getImage(),count=normalizeRegions(q?.eyeRegions).length;
    $('blink-setup').disabled=busy||!image;$('blink-preview-closed').disabled=busy||!image||!count;
    $('blink-preview-closed').textContent=forced===1?'恢复睁眼':'查看闭眼';$('blink-preview-closed').setAttribute('aria-pressed',forced===1);
    $('blink-status').textContent=!image?'选择图片后，一只眼睛框一个框。':count?`当前图片已设置 ${count} 只眼睛 · ${q.closedImage?'闭眼图模式':'单图局部闭合'}`:'当前图片尚未框选眼睛。点击上方按钮设置。';
    $('blink-keyframe-name').textContent=q?.closedImage?`已设置：${q.closedName||'闭眼图'}`:'未设置：使用单图局部闭合';$('blink-remove-keyframe').hidden=!q?.closedImage;
    $('blink-import-box').hidden=!pending?.length;$('blink-apply-import').disabled=busy||!image;
  }
  const editor=createEyeEditor((q,regions)=>{q.eyeRegions=regions;invalidate(q);if(regions.length)getConfig().blinkEnabled=true;onChange();message(regions.length?`已保存 ${regions.length} 只眼睛，可点“查看闭眼”检查，或播放预览。`:'已清空当前图片的眼睛位置。');});
  $('blink-setup').onclick=()=>{const q=getActive(),image=getImage();if(!q||!image)return;pause();forced=null;editor.open(image,q);};
  $('blink-preview-closed').onclick=()=>{pause();forced=forced===1?0:1;getConfig().blinkEnabled=true;onChange();};
  $('blink-keyframe').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';const q=getActive(),image=getImage();if(!file||!q||!image)return;
    if(!/\.(png|jpe?g|webp|avif)$/i.test(file.name)||file.size>30*1024*1024){message('请选择 30 MB 以内的 PNG / JPG / WebP / AVIF 闭眼图片。',true);return;}
    const src=URL.createObjectURL(file);
    try{const closed=new Image();closed.src=src;await closed.decode();if(closed.naturalWidth*closed.naturalHeight>50000000)throw new Error('闭眼图尺寸过大');const difference=Math.abs((closed.naturalWidth/closed.naturalHeight)/(image.naturalWidth/image.naturalHeight)-1);if(difference>.01)throw new Error('闭眼图与原图的宽高比例不一致，请使用相同构图的图片');if(getActive()!==q){URL.revokeObjectURL(src);return;}if(q.closedSrc)URL.revokeObjectURL(q.closedSrc);q.closedSrc=src;q.closedImage=closed;q.closedName=file.name;invalidate(q);getConfig().blinkEnabled=true;onChange();message('已设置闭眼图片。请确认眼睛框和人物位置对应，再检查闭眼效果。');}
    catch(err){URL.revokeObjectURL(src);message(`无法使用这张闭眼图：${err.message}。`,true);}
  };
  $('blink-remove-keyframe').onclick=()=>{const q=getActive();if(!q)return;if(q.closedSrc)URL.revokeObjectURL(q.closedSrc);delete q.closedSrc;delete q.closedImage;delete q.closedName;invalidate(q);onChange();message('已切回单图局部闭合。');};
  $('blink-apply-import').onclick=()=>{const q=getActive();if(!q||!getImage()||!pending)return;q.eyeRegions=normalizeRegions(pending);pending=null;invalidate(q);getConfig().blinkEnabled=true;onChange();message('眼睛位置已应用到当前图片。请检查框选位置；闭眼图片需在本机重新选择。');};
  return {
    refresh,override:()=>forced,
    resetOverride(){forced=null;refresh();},
    prepare(q,img){if(!q||!img)return null;const signature=JSON.stringify(normalizeRegions(q.eyeRegions))+(q.closedSrc||'');if(q.blinkSignature!==signature){q.blinkState=prepareBlink(img,q.eyeRegions,q.closedImage);q.blinkSignature=signature;}return q.blinkState;},
    release(q){if(q.closedSrc)URL.revokeObjectURL(q.closedSrc);delete q.closedImage;delete q.blinkState;},
    preset(){const q=getActive(),img=getImage();return q&&img?{imageName:q.name,width:img.naturalWidth,height:img.naturalHeight,eyeRegions:normalizeRegions(q.eyeRegions),usesClosedImage:!!q.closedImage}:null;},
    importPreset(preset){pending=normalizeRegions(preset?.eyeRegions);forced=null;refresh();return pending.length;}
  };
}
