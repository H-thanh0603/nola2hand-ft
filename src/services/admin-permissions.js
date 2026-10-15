function assertRoleManager(actor, targetId) {
  if (!actor.canManageRoles || !actor.roles.includes('ADMIN_FINANCE')) throw Object.assign(new Error('Cần quyền quản lý phân quyền riêng'), { status: 403 });
  if (actor.id === targetId) throw Object.assign(new Error('Không được thay đổi quyền của chính mình'), { status: 403 });
}
async function protectAdminTarget(tx, actor, targetId) {
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(1502026)');
  const target = await tx.user.findUnique({ where: { id: targetId }, include: { roles: { include: { role: true } } } });
  if (!target) throw Object.assign(new Error('Không tìm thấy tài khoản'), { status: 404 });
  if (target.roles.some(r => r.role.name.startsWith('ADMIN'))) assertRoleManager(actor, targetId);
  if (target.canManageRoles) {
    const remaining = await tx.user.count({ where: { id: { not: targetId }, status: 'ACTIVE', canManageRoles: true, roles: { some: { role: { name: 'ADMIN_FINANCE' } } } } });
    if (!remaining) throw Object.assign(new Error('Không được khóa người quản lý phân quyền cuối cùng'), { status: 409 });
  }
  return target;
}
module.exports = { assertRoleManager, protectAdminTarget };
