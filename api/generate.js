export default async function handler(req, res) {
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

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN environment variable' });
    }

    const modelVersion = process.env.REPLICATE_VIDEO_MODEL_VERSION || process.env.REPLICATE_MODEL_VERSION;
    const modelName = process.env.REPLICATE_VIDEO_MODEL || process.env.REPLICATE_MODEL || 'luma-ai/dream-machine';
    let versionId = modelVersion;

    if (!versionId) {
      if (!modelName) {
        return res.status(500).json({
          error: 'Missing model configuration. Set REPLICATE_VIDEO_MODEL_VERSION, REPLICATE_MODEL_VERSION, REPLICATE_VIDEO_MODEL, or REPLICATE_MODEL.',
        });
      }

      const modelResponse = await fetch(`https://api.replicate.com/v1/models/${encodeURIComponent(modelName)}`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const modelData = await modelResponse.json();
      if (!modelResponse.ok || !modelData?.latest_version?.id) {
        return res.status(modelResponse.status || 500).json({
          error: modelData?.detail || modelData?.error || `Unable to resolve version for model ${modelName}`,
        });
      }

      versionId = modelData.latest_version.id;
    }

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: versionId,
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
