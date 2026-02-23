const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('SUPABASE_URL:', supabaseUrl ? 'tersedia' : 'TIDAK ADA');
console.log('SUPABASE_KEY:', supabaseKey ? 'tersedia' : 'TIDAK ADA');

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateSitemap() {
  const { data, error } = await supabase
    .from('movies')
    .select('id');

  if (error) {
    console.error('Error dari Supabase:', error);
    process.exit(1);
  }

  console.log(`Berhasil mengambil ${data.length} film`);

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
  console.log('Sitemap berhasil dibuat!');
}

generateSitemap();
