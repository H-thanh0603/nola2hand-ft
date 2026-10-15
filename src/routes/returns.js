const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { auth,requireRole,validate,asyncHandler } = require('../middleware');
const { accountLimit } = require('../services/guards');
const { paginate,pagedResult } = require('../utils');
const { requestReturn,transitionReturn } = require('../services/returns');
const router=express.Router();
router.use(auth);
router.post('/orders/:id',accountLimit('RETURN_REQUEST',5,86400000),validate(z.object({reason:z.string().trim().min(10).max(1000),evidences:z.array(z.string().url().refine(u=>/^https?:\/\//.test(u),'Chỉ nhận URL HTTP/HTTPS')).max(5).default([])})),asyncHandler(async(req,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id);
  await require('../services/evidence').assertOwnEvidence(req.body.evidences,req.user.id);
  res.status(201).json(await requestReturn(prisma,req.user.id,id,req.body));
}));
async function list(req,res,admin=false){
  const {page,limit,skip}=paginate(req.query);
  const where=admin?{}:{order:{OR:[{buyerId:req.user.id},{sellerId:req.user.id}]}};
  if(req.query.status)where.status=z.enum(['REQUESTED','APPROVED','SHIPPED','RECEIVED','REFUNDED','REJECTED','CANCELLED']).parse(req.query.status);
  const [data,total]=await Promise.all([prisma.returnRequest.findMany({where,include:{order:{include:{listing:{include:{images:{take:1}}},buyer:{select:{fullName:true}},seller:{select:{fullName:true}}}}},orderBy:{requestedAt:'desc'},skip,take:limit}),prisma.returnRequest.count({where})]);
  res.json(pagedResult(data,total,page,limit));
}
router.get('/',asyncHandler((req,res)=>list(req,res)));
router.get('/admin',requireRole('ADMIN_FINANCE'),asyncHandler((req,res)=>list(req,res,true)));
router.patch('/:id',accountLimit('RETURN_ACTION',30,3600000),validate(z.object({action:z.enum(['APPROVE','REJECT','CANCEL','SHIP','RECEIVE','REFUND','COD_REFUND','COD_CONFIRM']),note:z.string().trim().min(3).max(1000).optional(),trackingCode:z.string().trim().min(3).max(150).optional(),codReference:z.string().trim().min(3).max(150).optional()})),asyncHandler(async(req,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id);
  if(['APPROVE','REJECT','RECEIVE','REFUND'].includes(req.body.action)&&!req.body.note)return res.status(400).json({message:'Cần lý do hoặc ghi chú cho bước xử lý'});
  res.json(await transitionReturn(prisma,req.user,id,req.body));
}));
module.exports=router;
