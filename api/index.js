export default async function handler(req, res) {
  // إعدادات جدار حماية CORS للربط مع بلوجر
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'يرجى وضع رابط فيديو صحيح' });
  }

  // 1. معالج تيك توك المباشر بواسطة (TikWM POST)
  if (videoUrl.includes('tiktok.com')) {
    try {
      const body = new URLSearchParams({ url: videoUrl, hd: '1' });
      const tikRes = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        },
        body: body
      });
      const tikData = await tikRes.json();
      if (tikData && tikData.data && (tikData.data.play || tikData.data.hdplay)) {
        return res.status(200).json({
          url: tikData.data.hdplay || tikData.data.play,
          title: tikData.data.title || 'TikTok Video'
        });
      }
    } catch(e) {}
  }

  // 2. معالج يوتيوب المباشر (Invidious Array)
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    const match = videoUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    const ytId = (match && match[2].length === 11) ? match[2] : null;

    if (ytId) {
      const nodes = [
        `https://inv.nadeko.net/api/v1/videos/${ytId}`,
        `https://yewtu.be/api/v1/videos/${ytId}`,
        `https://invidious.nerdvpn.de/api/v1/videos/${ytId}`
      ];

      for (let node of nodes) {
        try {
          const ytRes = await fetch(node, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (!ytRes.ok) continue;
          const ytData = await ytRes.json();
          if (ytData && ytData.formatStreams && ytData.formatStreams.length > 0) {
            return res.status(200).json({
              url: ytData.formatStreams[0].url,
              title: ytData.title || 'YouTube Video'
            });
          }
        } catch(e) {}
      }
    }
  }

  // 3. معالج إنستغرام وفيسبوك المباشر
  try {
    const genRes = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(videoUrl)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const genData = await genRes.json();
    if (genData && (genData.video || genData.url)) {
      return res.status(200).json({
        url: genData.video || genData.url,
        title: 'Video'
      });
    }
  } catch(e) {}

  // 4. معالج Cobalt المباشر الاحتياطي
  try {
    const cobRes = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({ url: videoUrl, videoQuality: 'max', noWatermark: true })
    });
    const cobData = await cobRes.json();
    if (cobData && (cobData.url || cobData.picker)) {
      return res.status(200).json({
        url: cobData.url || (cobData.picker ? cobData.picker[0].url : '')
      });
    }
  } catch(e) {}

  return res.status(500).json({ error: 'تعذر جلب الفيديو، تأكد من أن الفيديو عام وتجربة رابط آخر' });
}
