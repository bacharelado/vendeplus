// AI is postponed by the project owner. Keep the route explicitly disabled,
// including when an AI binding happens to remain configured in the host.
export async function onRequest({request}:{request:Request;env?:unknown}){
 if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST'}});
 return Response.json({error:'O preenchimento por IA está desativado. Preencha os campos do anúncio.'},{status:503,headers:{'Cache-Control':'no-store'}});
}
