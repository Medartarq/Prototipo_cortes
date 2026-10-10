import {optimize} from './optimizer.mjs';
self.onmessage=async({data})=>{try{const result=await optimize(data.pieces,data.config,data.iterations,(percent)=>self.postMessage({type:'progress',percent}));self.postMessage({type:'done',result});}catch(e){self.postMessage({type:'error',message:e.message});}};
