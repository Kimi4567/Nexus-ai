export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const modelVersion = process.env.REPLICATE_VIDEO_MODEL_VERSION || process.env.REPLICATE_MODEL_VERSION;
    if (!modelVersion) {
      return res.status(500).json({
        error:
          'Missing REPICATE_VIDEO_MODEL_VERSION or REPLICATE_MODEL_VERSION environment variable',
      });
    }

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: modelVersion,
        input: { prompt },
      }),
    });

    const prediction = await response.json();

    if (!response.ok) {
      return res.status(response.status || 500).json({
        error:
          prediction?.detail || prediction?.error || 'Failed to create prediction',
      });
    }

    return res.status(200).json(prediction);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
