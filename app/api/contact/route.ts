import { NextResponse, type NextRequest } from 'next/server';
import { mongoConfigured, mongoDb } from '@/lib/mongodb/client';
import { badRequest, jsonError, parseBody, str } from '@/lib/api';
import { rateLimit } from '@/lib/mongodb/limits';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 try{
  if(!mongoConfigured())return badRequest('Contact form temporarily unavailable. Please try again later.',503);
  const b=await parseBody(request,5000);
  if(b.website)return badRequest('Request rejected');
  const name=str(b.name,100),phone=str(b.phone,30),message=str(b.message,2000);
  if(name.length<2||!/^[+\d().\s-]{7,30}$/.test(phone)||message.length<10)return badRequest('Enter your name, phone number and a message (at least 10 characters).');
  await rateLimit(request,'contact',3,60);
  await (await mongoDb()).collection('catering_inquiries').insertOne({customer_name:name,customer_phone:phone,event_date:null,guest_count:null,message,source:'contact',status:'new',created_at:new Date()});
  return NextResponse.json({message:'Thank you! We received your message and will contact you directly.'},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch(e){return jsonError(e,'Unable to send contact request');}
}
