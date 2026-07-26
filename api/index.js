export default async function handler(req, res) {
  // إعدادات CORS المباشرة لبلوجر
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ status: 'error', message: 'يرجى وضع رابط فيديو صحيح' });
  }

  videoUrl = videoUrl.trim();
  const matchUrl = videoUrl.match(/(https?:\/\/[^\s]+)/g);
  if (matchUrl) videoUrl = matchUrl[0];

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  };

  try {
    let extractedUrl = null;
    let audioUrl = null;

    // 1. معالج تيك توك المباشر
    if (videoUrl.includes('tiktok.com')) {
      const body = new URLSearchParams({ url: videoUrl, hd: '1' });
      const tikRes = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          ...browserHeaders
        },
        body: body
      });
      const tikData = await tikRes.json();
      if (tikData && tikData.data && (tikData.data.play || tikData.data.hdplay)) {
        extractedUrl = tikData.data.hdplay || tikData.data.play;
        audioUrl = tikData.data.music || null;
      }
    }

    // 2. معالج يوتيوب المباشر و Shorts
    if (!extractedUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
      const match = videoUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/);
      const ytId = (match && match[2].length === 11) ? match[2] : null;

      if (ytId) {
        const ytNodes = [
          `https://inv.nadeko.net/api/v1/videos/${ytId}`,
          `https://yewtu.be/api/v1/videos/${ytId}`,
          `https://invidious.nerdvpn.de/api/v1/videos/${ytId}`,
          `https://api.piped.video/streams/${ytId}`
        ];

        for (let node of ytNodes) {
          try {
            const ytRes = await fetch(node, { headers: browserHeaders });
            if (!ytRes.ok) continue;
            const ytData = await ytRes.json();
            let streams = ytData.formatStreams || ytData.videoStreams;
            if (streams && streams.length > 0) {
              extractedUrl = streams[0].url;
              break;
            }
          } catch(e) {}
        }
      }
    }

    // 3. معالج إنستغرام وفيسبوك والمنصات الشاملة
    if (!extractedUrl) {
      try {
        const genRes = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(videoUrl)}`, { headers: browserHeaders });
        const genData = await genRes.json();
        if (genData && (genData.video || genData.url)) {
          extractedUrl = genData.video || genData.url;
        }
      } catch(e) {}
    }

    // 4. معالج Cobalt المباشر
    if (!extractedUrl) {
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
          extractedUrl = cobData.url || (cobData.picker ? cobData.picker[0].url : '');
        }
      } catch(e) {}
    }

    if (extractedUrl) {
      return res.status(200).json({
        status: 'success',
        downloadUrl: extractedUrl,
        audioUrl: audioUrl
      });
    }

    return res.status(404).json({
      status: 'error',
      message: 'تعذر جلب الفيديو، تأكد من أن الرابط مباشر والمقطع عام (Public).'
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'خطأ في السيرفر' });
  }
}
