export default async function handler(req, res) {
  // السماح لمدونة بلوجر بالاتصال بالسيرفر دون حظر المتصفحات
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'يرجى وضع رابط فيديو' });
  }

  try {
    const response = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: videoUrl,
        videoQuality: 'max',
        noWatermark: true
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'حدث خطأ أثناء جلب الفيديو' });
  }
}
