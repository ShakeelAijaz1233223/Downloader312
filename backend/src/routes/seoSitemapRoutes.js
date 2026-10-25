import express from 'express';
import { ENV } from '../config/env.js';
import { sqlQuery } from '../db/database.js';
import { getActivePlatformsFromDb } from '../services/extractorEngine.js';
import { asyncHandler } from '../utils/errors.js';

export const seoSitemapRouter = express.Router();

// Clean Google-Safe robots.txt (NEVER discloses secret admin path!)
seoSitemapRouter.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Allow: /tools/',
      'Allow: /sites',
      'Disallow: /api/',
      'Disallow: /admin',
      'Disallow: /wp-admin',
      `Sitemap: ${ENV.PUBLIC_SITE_URL}/sitemap.xml`,
    ].join('\n')
  );
});

// Dynamic XML Sitemap indexing Homepage + Supported Sites + All SQL Programmatic /tools/:slug Pages!
seoSitemapRouter.get(
  '/sitemap.xml',
  asyncHandler(async (_req, res) => {
    const [platforms, keywords] = await Promise.all([
      getActivePlatformsFromDb(),
      sqlQuery('SELECT slug FROM seo_keywords'),
    ]);

    const cleanSlugs = new Set(
      platforms.filter((p) => !p.isAdult).map((p) => p.seoSlug)
    );
    for (const k of keywords) {
      if (k.slug) cleanSlugs.add(k.slug);
    }

    const staticPaths = ['/', '/sites', '/player', '/albums'];
    const toolPaths = Array.from(cleanSlugs).map((s) => `/tools/${s}`);
    const allPaths = [...staticPaths, ...toolPaths];
    const today = new Date().toISOString().slice(0, 10);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths
  .map(
    (p) => `  <url>
    <loc>${ENV.PUBLIC_SITE_URL}${p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p === '/' ? '1.0' : '0.85'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  })
);
