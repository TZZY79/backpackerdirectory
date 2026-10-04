/* Backpacker Directory — site settings.
   Edit this file to switch features on. Nothing in here is secret (it is public on the site). */
window.BD_CONFIG = {
  siteName: 'Backpacker Directory',
  siteUrl: 'https://backpackerdirectory.com',

  /* YouTube: Backpacker TT (@TTTT-BCN) */
  ytChannelUrl: 'https://www.youtube.com/@TTTT-BCN',
  ytSubscribeUrl: 'https://www.youtube.com/@TTTT-BCN?sub_confirmation=1',
  ytPlaylistId: 'PLKxHYwa7Ft84Wxb4nGzDdn8m1zOCFQR-y',

  /* Moderated submissions (events, comments, wall, business, agent, newsletter).
     Paste the Google Apps Script "web app" URL here once it is deployed (see SETUP-APPROVALS.md).
     While this is empty, forms politely say "submissions open soon" and nothing is collected or shown. */
  submitUrl: '',

  /* Optional: Zalo Official Account ID. If you ever create a free Zalo OA, put its ID here and the
     Zalo button becomes a one-tap share instead of "copy + open Zalo". */
  zaloOaId: '',

  /* Optional: your Discord invite link, e.g. 'https://discord.gg/xxxxxxx'. Leave '' until it exists. */
  discordInvite: '',

  /* Donations (crypto). Shown on EVERY page, just above the footer.
     EVM address = the same address works on Ethereum, BNB Smart Chain, Polygon, Arbitrum, Base, Optimism.
     Set donateAddress to '' to hide the box everywhere. */
  donateAddress: '0x6a7B8640969e11cb436f178E7950e5f9aeBf8f77',
  donateNetworks: ['Ethereum', 'BNB Smart Chain (BEP-20)', 'Polygon', 'Arbitrum', 'Base', 'Optimism'],
  donateTokens: ['USDT', 'USDC', 'ETH', 'BNB', 'POL'],

  /* Data files that YOU control (no code needed) */
  communityNewsUrl: 'assets/data/community-news.json',
  blogUrl: 'assets/data/blog.json'
};
