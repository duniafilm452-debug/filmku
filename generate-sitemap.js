const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function generateSitemap() {
  // Ambil semua ID film dari Supabase
  // Ganti 'films' dengan nama tabel kamu
  // Ganti 'id' dengan nama kolom ID kamu
  const { data, error } = await supabase
    .from('movies')
    .select('id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  const baseUrl = 'https://jelajahifilm.my.id';
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <priority>1.0</priority>
  </url>

`;

  data.forEach(film => {
    xml += `  <url>
    <loc>${baseUrl}/player?id=${film.id}</loc>
    <lastmod>${today}</lastmod>
    <priority>0.8</priority>
  </url>

`;
  });

  xml += `</urlset>`;

  fs.writeFileSync('sitemap.xml', xml);
  console.log(`Sitemap generated dengan ${data.length} film!`);
}

generateSitemap();
