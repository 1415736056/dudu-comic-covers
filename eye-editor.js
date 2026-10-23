import {normalizeRegions} from './blink-engine.js?v=20261023-1';
const $=id=>document.getElementById(id);
export function createEyeEditor(onSave){
  let image=null,regions=[],draft=null,drag=null,pan=false,target=null;
  const dialog=$('eye-dialog'),surface=$('eye-canvas'),scroller=$('eye-scroller');
  function repaint(){
    if(!image)return;const ctx=surface.getContext('2d'),w=surface.width,h=surface.height;ctx.drawImage(image,0,0,w,h);ctx.lineWidth=Math.max(2,w/450);ctx.font=`bold ${Math.max(14,w/65)}px sans-serif`;
    [...regions,...(draft?[draft]:[])].forEach((r,i)=>{ctx.fillStyle='rgba(0,174,226,.13)';ctx.fillRect(r.x*w,r.y*h,r.w*w,r.h*h);ctx.strokeStyle='#ffdf52';ctx.strokeRect(r.x*w,r.y*h,r.w*w,r.h*h);ctx.fillStyle='#ffdf52';ctx.fillText(String(i+1),r.x*w+3,Math.max(18,r.y*h-5));});
  }
  function list(){
    $('eye-list').innerHTML=regions.map((r,i)=>`<div class="eye-row"><strong>眼睛 ${i+1}</strong>${['x','y','w','h'].map((key,j)=>`<label>${['左','上','宽','高'][j]}<input type="number" data-index="${i}" data-key="${key}" aria-label="眼睛${i+1}${['左坐标','上坐标','宽度','高度'][j]}" min="0" max="${key==='x'||key==='w'?surface.width:surface.height}" value="${Math.round(r[key]*(key==='x'||key==='w'?surface.width:surface.height))}"></label>`).join('')}<label>角度<input type="number" data-index="${i}" data-key="angle" aria-label="眼睛${i+1}角度" min="-80" max="80" value="${r.angle||0}"></label><button data-delete="${i}" class="text-button" aria-label="删除眼睛${i+1}">删除</button></div>`).join('');
    $('eye-count').textContent=`已框选 ${regions.length} / 12 只眼睛`;
  }
  function zoom(){const width=Math.max(1,scroller.clientWidth-2)*Number($('eye-zoom').value)/100;surface.style.width=width+'px';surface.style.height=width*surface.height/surface.width+'px';$('eye-zoom-value').textContent=$('eye-zoom').value+'%';}
  function point(e){const box=surface.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(e.clientY-box.top)/box.height))};}
  function finish(e){if(!drag)return;if(!pan&&draft&&regions.length<12){regions=normalizeRegions([...regions,draft]);list();}draft=null;drag=null;repaint();try{surface.releasePointerCapture(e.pointerId);}catch{}}
  surface.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();surface.setPointerCapture(e.pointerId);drag=pan?{px:e.clientX,py:e.clientY,sx:scroller.scrollLeft,sy:scroller.scrollTop}:point(e);};
  surface.onpointermove=e=>{if(!drag)return;e.preventDefault();if(pan){scroller.scrollLeft=drag.sx+drag.px-e.clientX;scroller.scrollTop=drag.sy+drag.py-e.clientY;return;}const p=point(e);draft={x:Math.min(drag.x,p.x),y:Math.min(drag.y,p.y),w:Math.abs(p.x-drag.x),h:Math.abs(p.y-drag.y)};repaint();};
  surface.onpointerup=finish;surface.onpointercancel=()=>{drag=null;draft=null;repaint();};
  $('eye-zoom').oninput=zoom;$('eye-tool').onclick=()=>{pan=!pan;$('eye-tool').textContent=pan?'当前：移动画布':'当前：框选眼睛';$('eye-tool').setAttribute('aria-pressed',pan);surface.style.cursor=pan?'grab':'crosshair';};
  $('eye-list').onclick=e=>{const button=e.target.closest('[data-delete]');if(button){regions.splice(Number(button.dataset.delete),1);list();repaint();}};
  $('eye-list').onchange=e=>{const el=e.target;if(!el.dataset.key)return;const index=Number(el.dataset.index),key=el.dataset.key;if(!regions[index])return;regions[index][key]=key==='angle'?Number(el.value):Number(el.value)/(key==='x'||key==='w'?surface.width:surface.height);regions=normalizeRegions(regions);list();repaint();};
  $('eye-undo').onclick=()=>{regions.pop();list();repaint();};$('eye-clear').onclick=()=>{regions=[];list();repaint();};
  $('eye-cancel').onclick=()=>dialog.close();$('eye-save').onclick=()=>{onSave(target,normalizeRegions(regions));dialog.close();};
  const onResize=()=>{if(dialog.open)zoom();};window.addEventListener('resize',onResize);
  return {open(img,q){image=img;target=q;regions=normalizeRegions(q.eyeRegions||[]);draft=null;drag=null;surface.width=img.naturalWidth;surface.height=img.naturalHeight;$('eye-zoom').value=100;pan=false;$('eye-tool').textContent='当前：框选眼睛';$('eye-tool').setAttribute('aria-pressed','false');surface.style.cursor='crosshair';dialog.showModal();zoom();list();repaint();scroller.scrollLeft=scroller.scrollTop=0;},isOpen:()=>dialog.open};
}
