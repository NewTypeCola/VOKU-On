import { report, response } from "../../../server/uxStudy.js";
export async function onRequest({request,env}) {
  if(request.method!=="GET")return response({error:"GET only"},405);
  try{return await report(request,env);}catch{return response({error:"로그를 불러오지 못했습니다."},503);}
}
