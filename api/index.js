export default async function handler(req, res) {
  // إعدادات CORS للسماح لمدونة بلوجر بالاتصال بالسيرفر
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  };

  try {
    let downloadUrl = null;
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
        downloadUrl = tikData.data.hdplay || tikData.data.play;
        if (downloadUrl.startsWith('/')) downloadUrl = 'https://www.tikwm.com' + downloadUrl;
        audioUrl = tikData.data.music || null;
        if (audioUrl && audioUrl.startsWith('/')) audioUrl = 'https://www.tikwm.com' + audioUrl;
      }
    }

    // 2. معالج فيسبوك وإنستغرام (FB Watch / FB Reels / Posts)
    if (!downloadUrl) {
      try {
        const fbRes = await fetch(`https://api.vkrdown.com/v2/?url=${encodeURIComponent(videoUrl)}`, { headers: browserHeaders });
        const fbData = await fbRes.json();
        if (fbData && fbData.data && (fbData.data.url || fbData.data.downloads)) {
          downloadUrl = fbData.data.url || fbData.data.downloads[0].url;
        }
      } catch(e) {}
    }

    // 3. معالج يوتيوب المباشر التبادلي
    if (!downloadUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
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
              downloadUrl = streams[0].url;
              break;
            }
          } catch(e) {}
        }
      }
    }

    // 4. معالج احتياطي شامل للروابط الصعبة
    if (!downloadUrl) {
      try {
        const genRes = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(videoUrl)}`, { headers: browserHeaders });
        const genData = await genRes.json();
        if (genData && (genData.video || genData.url)) {
          downloadUrl = genData.video || genData.url;
        }
      } catch(e) {}
    }

    if (downloadUrl) {
      return res.status(200).json({
        status: 'success',
        downloadUrl: downloadUrl,
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
