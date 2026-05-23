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

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN environment variable' });
    }

    const modelVersion = process.env.REPLICATE_VIDEO_MODEL_VERSION || process.env.REPLICATE_MODEL_VERSION;
    const modelName = process.env.REPLICATE_VIDEO_MODEL || process.env.REPLICATE_MODEL || 'luma-ai/dream-machine';
    let versionId = modelVersion;

    if (!versionId) {
      const modelResponse = await fetch(`https://api.replicate.com/v1/models/${encodeURIComponent(modelName)}`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const modelData = await modelResponse.json();
      if (!modelResponse.ok || !modelData?.latest_version?.id) {
        return res.status(modelResponse.status || 500).json({
          error: modelData?.detail || modelData?.error || `Unable to resolve model version for ${modelName}`,
        });
      }

      versionId = modelData.latest_version.id;
    }

    const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
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

    const prediction = await predictionResponse.json();
    if (!predictionResponse.ok) {
      return res.status(predictionResponse.status || 500).json({
        error: prediction?.detail || prediction?.error || 'Failed to create prediction',
      });
    }

    const predictionId = prediction.id;
    const maxAttempts = 20;
    let attempts = 0;
    let finalPrediction = prediction;

    while (attempts < maxAttempts) {
      if (finalPrediction.status === 'succeeded') {
        break;
      }
      if (finalPrediction.status === 'failed' || finalPrediction.status === 'canceled') {
        return res.status(500).json({
          error: finalPrediction?.error || `Prediction ${finalPrediction.status}`,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(predictionId)}`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      finalPrediction = await statusResponse.json();
      if (!statusResponse.ok) {
        return res.status(statusResponse.status || 500).json({
          error: finalPrediction?.detail || finalPrediction?.error || 'Failed to poll prediction status',
        });
      }

      attempts += 1;
    }

    if (finalPrediction.status !== 'succeeded') {
      return res.status(500).json({ error: 'Prediction did not complete in time. Please try again.' });
    }

    const resultOutput = Array.isArray(finalPrediction.output) ? finalPrediction.output[0] : finalPrediction.output;
    if (!resultOutput) {
      return res.status(500).json({ error: 'No video URL returned from prediction.' });
    }

    return res.status(200).json({
      id: predictionId,
      status: 'succeeded',
      output: resultOutput,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
