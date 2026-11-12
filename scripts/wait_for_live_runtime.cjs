const fs=require('fs');
const crypto=require('crypto');
const {setTimeout:pause}=require('timers/promises');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected=hash(fs.readFileSync('assets/ast-conversion.js'));
(async()=>{
  for(let attempt=1;attempt<=30;attempt++){
    try{
      const response=await fetch('https://dmitryiudin-web.github.io/assets/ast-conversion.js?v=20260831',{cache:'no-store',signal:AbortSignal.timeout(12000)});
      const bytes=Buffer.from(await response.arrayBuffer());
      if(response.ok&&hash(bytes)===expected){console.log('Published runtime matches source on attempt',attempt);return;}
      console.log('Waiting for matching runtime:',response.status,'attempt',attempt);
    }catch(e){console.log('Waiting for runtime:',String(e),'attempt',attempt);}
    await pause(20000);
  }
  throw Error('Published runtime did not match the tested commit before timeout');
})().catch(e=>{console.error(e);process.exitCode=1});
