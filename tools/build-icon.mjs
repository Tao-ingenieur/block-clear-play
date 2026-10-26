import fs from 'node:fs/promises';
// Original four-square mark, encoded as a Windows ICO without image dependencies.
const size=256,rowBytes=size*4,maskBytes=size*size/8;
const bmp=Buffer.alloc(40+rowBytes*size+maskBytes);
bmp.writeUInt32LE(40,0);bmp.writeInt32LE(size,4);bmp.writeInt32LE(size*2,8);
bmp.writeUInt16LE(1,12);bmp.writeUInt16LE(32,14);bmp.writeUInt32LE(rowBytes*size+maskBytes,20);
const squares=[[107,53],[53,107],[107,107],[161,107]];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const outside=Math.hypot(Math.max(0,Math.abs(x-127.5)-87.5),Math.max(0,Math.abs(y-127.5)-87.5))>36;
  const mark=squares.some(([sx,sy])=>x>=sx&&x<sx+42&&y>=sy&&y<sy+42);
  const offset=40+(size-1-y)*rowBytes+x*4;
  const color=mark?[178,214,191]:[17,25,28];
  bmp[offset]=color[2];bmp[offset+1]=color[1];bmp[offset+2]=color[0];bmp[offset+3]=outside?0:255;
  if(outside)bmp[40+rowBytes*size+(size-1-y)*(size/8)+Math.floor(x/8)]|=1<<(7-x%8);
}
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);
header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(bmp.length,14);header.writeUInt32LE(22,18);
const folder=new URL('../apps/desktop/assets/',import.meta.url);
await fs.mkdir(folder,{recursive:true});await fs.writeFile(new URL('icon.ico',folder),Buffer.concat([header,bmp]));
