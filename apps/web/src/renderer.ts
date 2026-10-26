import {cells, ghost, HIDDEN, SHAPES} from '../../../packages/core/src/index.ts';
import type {GameState, Kind} from '../../../packages/core/src/index.ts';

export type Theme = 'dark' | 'light' | 'contrast';
export const PALETTES: Record<Theme,Record<Kind|'G',string>> = {
  dark:{I:'#e6b66a',O:'#d5a3bb',T:'#8ebba7',S:'#a8acd5',Z:'#df927b',J:'#8db9ce',L:'#b7bf83',G:'#53646a'},
  light:{I:'#976522',O:'#aa547a',T:'#347860',S:'#666aac',Z:'#ac5238',J:'#39788f',L:'#6b7629',G:'#9daeb0'},
  contrast:{I:'#ffcf40',O:'#ff8bc9',T:'#81f5bf',S:'#c5aaff',Z:'#ff9d71',J:'#76d5ff',L:'#e8ee99',G:'#c5cece'},
};
const SYMBOLS: Record<Kind,string> = {I:'−',O:'○',T:'+',S:'/',Z:'×',J:'·',L:'⌜'};
export function block(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, kind: Kind|'G', theme: Theme, symbols: boolean, outline = false): void {
  const color = PALETTES[theme][kind];
  const pad = size * .065;
  ctx.beginPath(); ctx.roundRect(x+pad,y+pad,size-pad*2,size-pad*2, size*.12);
  if (outline) {
    ctx.strokeStyle=color; ctx.globalAlpha=.48; ctx.lineWidth=1.4; ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1; return;
  }
  ctx.fillStyle=color; ctx.fill();
  ctx.fillStyle=theme==='light'?'#ffffff36':'#ffffff25';
  ctx.fillRect(x+pad+2,y+pad+2,size-pad*2-4,2);
  if (symbols && kind!=='G') {
    ctx.fillStyle=theme==='light'?'#fff':'#132327';ctx.font=`600 ${size*.5}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(SYMBOLS[kind],x+size/2,y+size/2);
  }
}
export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
  const dpr = Math.min(2,window.devicePixelRatio||1);
  if (canvas.width!==Math.round(width*dpr) || canvas.height!==Math.round(height*dpr)) {
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  }
  const ctx=canvas.getContext('2d')!;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}
export function drawBoard(canvas: HTMLCanvasElement,state: GameState,theme: Theme,symbols: boolean,visible=true): void {
  const width=canvas.clientWidth, height=canvas.clientHeight, ctx=fitCanvas(canvas,width,height), size=width/10;
  ctx.clearRect(0,0,width,height);
  ctx.strokeStyle=theme==='light'?'#182d3010':'#d0e3dd0b';ctx.lineWidth=1;
  for(let x=1;x<10;x++){ctx.beginPath();ctx.moveTo(x*size,0);ctx.lineTo(x*size,height);ctx.stroke();}
  for(let y=1;y<20;y++){ctx.beginPath();ctx.moveTo(0,y*size);ctx.lineTo(width,y*size);ctx.stroke();}
  if(!visible)return;
  for(let y=HIDDEN;y<40;y++)for(let x=0;x<10;x++){
    const kind=state.board[y]![x];if(kind)block(ctx,x*size,(y-HIDDEN)*size,size,kind,theme,symbols);
  }
  if(state.active){
    const landing=ghost(state.board,state.active);
    for(const [x,y] of cells(landing))if(y>=HIDDEN)block(ctx,x*size,(y-HIDDEN)*size,size,state.active.kind,theme,symbols,true);
    for(const [x,y] of cells(state.active))if(y>=HIDDEN)block(ctx,x*size,(y-HIDDEN)*size,size,state.active.kind,theme,symbols);
  }
}
export function drawPreview(canvas:HTMLCanvasElement,kind:Kind|null,theme:Theme,symbols:boolean):void{
  const width=canvas.clientWidth,height=canvas.clientHeight,ctx=fitCanvas(canvas,width,height);
  ctx.clearRect(0,0,width,height);if(!kind)return;
  const shape=SHAPES[kind][0]!;
  const minX=Math.min(...shape.map(c=>c[0])),maxX=Math.max(...shape.map(c=>c[0]));
  const minY=Math.min(...shape.map(c=>c[1])),maxY=Math.max(...shape.map(c=>c[1]));
  const size=Math.min(18,width/5), ox=(width-(maxX-minX+1)*size)/2,oy=(height-(maxY-minY+1)*size)/2;
  for(const [x,y]of shape)block(ctx,ox+(x-minX)*size,oy+(y-minY)*size,size,kind,theme,symbols);
}
