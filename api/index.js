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

  // تنظيف وتجهيز الرابط
  videoUrl = videoUrl.trim();
  const matchUrl = videoUrl.match(/(https?:\/\/[^\s]+)/g);
  if (matchUrl) videoUrl = matchUrl[0];

  try {
    let result = null;

    // 1. محرك تيك توك المباشر
    if (videoUrl.includes('tiktok.com')) {
      result = await handleTikTok(videoUrl);
    }

    // 2. محرك يوتيوب المباشر و Shorts
    if (!result && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'))) {
      result = await handleYouTube(videoUrl);
    }

    // 3. محرك إنستغرام وفيسبوك والمنصات الشاملة
    if (!result) {
      result = await handleUniversal(videoUrl);
    }

    if (result && result.downloads && result.downloads.length > 0) {
      return res.status(200).json({
        status: 'success',
        title: result.title || 'Video Download',
        preview: result.preview || result.downloads[0].url,
        downloads: result.downloads
      });
    }

    return res.status(404).json({
      status: 'error',
      message: 'لم نتمكن من جلب الفيديو، تأكد من أن الرابط مباشر والمقطع عام (Public).'
    });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'حدث خطأ في الخادم أثناء معالجة الفيديو' });
  }
}

// معالج تيك توك بدون علامة مائية + ملف MP3
async function handleTikTok(url) {
  try {
    const body = new URLSearchParams({ url: url, hd: '1' });
    const res = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
      },
      body: body
    });
    const data = await res.json();
    if (data && data.data && (data.data.play || data.data.hdplay)) {
      const mainVideo = data.data.hdplay || data.data.play;
      const downloads = [
        { quality: 'HD بدون علامة مائية', url: mainVideo, format: 'mp4' }
      ];
      if (data.data.music) {
        downloads.push({ quality: 'الملف الصوتي MP3', url: data.data.music, format: 'mp3' });
      }
      return { title: data.data.title || 'TikTok Video', preview: mainVideo, downloads };
    }
  } catch(e) {}
  return null;
}

// معالج يوتيوب التبادلي الشامل
async function handleYouTube(url) {
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/);
  const ytId = (match && match[2].length === 11) ? match[2] : null;
  if (!ytId) return null;

  const nodes = [
    `https://inv.nadeko.net/api/v1/videos/${ytId}`,
    `https://yewtu.be/api/v1/videos/${ytId}`,
    `https://invidious.nerdvpn.de/api/v1/videos/${ytId}`,
    `https://api.piped.video/streams/${ytId}`
  ];

  for (let node of nodes) {
    try {
      const res = await fetch(node, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;
      const data = await res.json();

      let streams = data.formatStreams || data.videoStreams;
      if (streams && streams.length > 0) {
        const downloads = streams.slice(0, 3).map((s) => ({
          quality: `جودة ${s.qualityLabel || s.quality || 'HD'} (${s.container || s.format || 'MP4'})`,
          url: s.url,
          format: 'mp4'
        }));
        return { title: data.title || 'YouTube Video', preview: downloads[0].url, downloads };
      }
    } catch(e) {}
  }
  return null;
}

// معالج إنستغرام وفيسبوك والمنصات الأخرى
async function handleUniversal(url) {
  try {
    const res = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const data = await res.json();
    if (data && (data.video || data.url)) {
      const mainVideo = data.video || data.url;
      return {
        title: 'Social Video',
        preview: mainVideo,
        downloads: [{ quality: 'تحميل مباشر HD', url: mainVideo, format: 'mp4' }]
      };
    }
  } catch(e) {}

  try {
    const res = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({ url: url, videoQuality: 'max', noWatermark: true })
    });
    const data = await res.json();
    if (data && (data.url || data.picker)) {
      const mainVideo = data.url || (data.picker ? data.picker[0].url : '');
      return {
        title: 'Video Download',
        preview: mainVideo,
        downloads: [{ quality: 'تحميل مباشر HD', url: mainVideo, format: 'mp4' }]
      };
    }
  } catch(e) {}

  return null;
}
