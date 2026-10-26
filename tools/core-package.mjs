import fs from 'node:fs/promises';
const metadata=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
await fs.writeFile(new URL('../../dist/core/package.json',import.meta.url),JSON.stringify({
  name:'@dropgrid/core',version:metadata.version,private:true,type:'module',
  exports:{'.':{types:'./index.d.ts',import:'./index.js'}},
},null,2)+'\n');
