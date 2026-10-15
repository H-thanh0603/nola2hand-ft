const prisma = require('../prisma');
const { listingWhere } = require('./catalog');
const { notify } = require('../utils');
async function notifyMatchingSearches(listingId, client = prisma) {
  const searches = await client.savedSearch.findMany({ where: { enabled: true } });
  let count = 0;
  for (const search of searches) {
    const listing = await client.listing.findFirst({ where: { ...listingWhere(search.filters), id: listingId }, select: { id: true, title: true, sellerId: true } });
    if (!listing || listing.sellerId === search.userId) continue;
    const publish = async tx => {
        const matched = await tx.savedSearchMatch.createMany({ data: [{ searchId: search.id, listingId }], skipDuplicates: true });
        if (!matched.count) return false;
        await notify(tx, search.userId, 'SAVED_SEARCH', `Tin mới cho “${search.name}”`, listing.title, { listingId, searchId: search.id });
        return true;
    };
    if (await (client.$transaction ? client.$transaction(publish) : publish(client))) count++;
  }
  return count;
}
module.exports = { notifyMatchingSearches };
