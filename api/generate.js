export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseError) {
        body = {};
      }
    }

    const { prompt } = body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const sampleVideos = [
      'https://www.w3schools.com/html/mov_bbb.mp4',
      'https://www.w3schools.com/html/movie.mp4',
      'https://www.w3schools.com/html/mov_bbb.mp4',
    ];

    const promptHash = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const videoIndex = promptHash % sampleVideos.length;
    const selectedVideo = sampleVideos[videoIndex];

    const predictionId = `mock-${Date.now()}`;

    return res.status(200).json({
      id: predictionId,
      status: 'succeeded',
      output: selectedVideo,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
