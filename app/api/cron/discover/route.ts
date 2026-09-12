import{discover}from'@/lib/collector';
export async function GET(req:Request){if(process.env.CRON_SECRET&&req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({error:'Unauthorized'},{status:401});try{return Response.json(await discover())}catch(error){console.error(error);return Response.json({error:'Collector failed'},{status:500})}}
