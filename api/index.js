export default async function handler(req, res) {
  // السماح لمدونة بلوجر بالاتصال بالـ API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'يرجى إدخال رابط فيديو' });
  }

  // إرسال هوية متصفح حقيقي لتجاوز الحظر
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
  };

  try {
    // 1. معالج تيك توك المباشر والسريع
    if (videoUrl.includes('tiktok.com')) {
      const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`, { headers: browserHeaders });
      const tikData = await tikRes.json();
      if (tikData && tikData.code === 0 && tikData.data) {
        return res.status(200).json({
          url: tikData.data.hdplay || tikData.data.play,
          title: tikData.data.title || 'TikTok Video'
        });
      }
    }

    // 2. معالج يوتيوب و Shorts
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      const match = videoUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/);
      const ytId = (match && match[2].length === 11) ? match[2] : null;

      if (ytId) {
        const ytEndpoints = [
          `https://api.piped.video/streams/${ytId}`,
          `https://pipedapi.kavin.rocks/streams/${ytId}`
        ];
        for (let ep of ytEndpoints) {
          try {
            const ytRes = await fetch(ep, { headers: browserHeaders });
            if (!ytRes.ok) continue;
            const ytData = await ytRes.json();
            if (ytData && ytData.videoStreams && ytData.videoStreams.length > 0) {
              return res.status(200).json({
                url: ytData.videoStreams[0].url,
                title: ytData.title || 'YouTube Video'
              });
            }
          } catch(e) {}
        }
      }
    }

    // 3. معالج إنستغرام وفيسبوك والسيرفرات العامة
    const cobaltNodes = [
      'https://co.wuk.sh/api/json',
      'https://api.cobalt.tools/api/json'
    ];

    for (let node of cobaltNodes) {
      try {
        const cobRes = await fetch(node, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
    }

    return res.status(500).json({ error: 'تعذر جلب الفيديو، تأكد من أن المقطع عام' });

  } catch (error) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
}
