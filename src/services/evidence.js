const path=require('node:path');
const fs=require('node:fs/promises');
const evidenceDirectory=path.join(__dirname,'../../.local/evidence');
const namePattern=/^[1-9]\d*-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/;
const origin=()=>(process.env.APP_URL||`http://localhost:${process.env.PORT||4000}`).replace(/\/$/,'');
function evidenceName(url){
  const parsed=new URL(url);
  if(parsed.origin!==origin()||!parsed.pathname.startsWith('/api/v1/upload/evidence/'))return null;
  const name=parsed.pathname.slice('/api/v1/upload/evidence/'.length);
  if(name.length>100||!namePattern.test(name)||parsed.search||parsed.hash)throw Object.assign(new Error('Đường dẫn bằng chứng không hợp lệ'),{status:400});
  return name;
}
async function assertOwnEvidence(urls,userId){
  for(const url of urls||[]){const name=evidenceName(url);if(!name)continue;if(Number(name.split('-')[0])!==userId)throw Object.assign(new Error('Không được đính kèm bằng chứng riêng của tài khoản khác'),{status:403});await fs.access(path.join(evidenceDirectory,name)).catch(()=>{throw Object.assign(new Error('Không tìm thấy ảnh bằng chứng'),{status:400});});}
}
async function mayReadEvidence(client,actor,url){
  const name=evidenceName(url);if(!name)return false;
  if(Number(name.split('-')[0])===actor.id||actor.roles.includes('ADMIN_FINANCE'))return true;
  const parties={OR:[{buyerId:actor.id},{sellerId:actor.id}]};
  const [returning,dispute]=await Promise.all([
    client.returnRequest.findFirst({where:{evidences:{array_contains:[url]},order:parties},select:{id:true}}),
    client.disputeEvidence.findFirst({where:{url,dispute:parties},select:{id:true}}),
  ]);
  return Boolean(returning||dispute);
}
module.exports={evidenceDirectory,namePattern,origin,evidenceName,assertOwnEvidence,mayReadEvidence};
