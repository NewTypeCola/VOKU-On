import { collect, response } from "../../../server/uxStudy.js";
export async function onRequest({request,env}) {
  if(request.method!=="POST")return response({error:"POST only"},405);
  try{return await collect(request,env);}catch{return response({error:"기록을 잠시 저장하지 못했습니다."},503);}
}
