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

    const runwayKey = process.env.RUNWAY_API_KEY;
    if (!runwayKey) {
      return res.status(500).json({ error: 'Missing RUNWAY_API_KEY environment variable' });
    }

    const model = process.env.RUNWAY_MODEL || 'runwayml/stable-diffusion-videos';
    const createResponse = await fetch('https://api.runwayml.com/v1/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${runwayKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: {
          prompt,
        },
      }),
    });

    const createData = await createResponse.json();
    if (!createResponse.ok) {
      return res.status(createResponse.status || 500).json({
        error: createData?.error?.message || createData?.message || 'Failed to start Runway generation',
      });
    }

    const generationId = createData?.id;
    if (!generationId) {
      return res.status(500).json({ error: 'Runway generation did not return an ID' });
    }

    let finalData = createData;
    const maxAttempts = 40;
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (finalData.status === 'succeeded') {
        break;
      }
      if (finalData.status === 'failed' || finalData.status === 'canceled') {
        return res.status(500).json({
          error: finalData?.error?.message || `Generation ${finalData.status}`,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
      const statusResponse = await fetch(`https://api.runwayml.com/v1/generations/${encodeURIComponent(generationId)}`, {
        headers: {
          Authorization: `Bearer ${runwayKey}`,
          'Content-Type': 'application/json',
        },
      });

      finalData = await statusResponse.json();
      if (!statusResponse.ok) {
        return res.status(statusResponse.status || 500).json({
          error: finalData?.error?.message || finalData?.message || 'Failed to poll Runway generation status',
        });
      }

      attempts += 1;
    }

    if (finalData.status !== 'succeeded') {
      return res.status(500).json({ error: 'Generation did not complete in time. Please try again later.' });
    }

    const output = Array.isArray(finalData.output) ? finalData.output[0] : finalData.output;
    const videoUrl = typeof output === 'string' ? output : output?.url || output?.download_url || null;
    if (!videoUrl) {
      return res.status(500).json({ error: 'No video URL returned from Runway generation.' });
    }

    return res.status(200).json({
      id: generationId,
      status: 'succeeded',
      output: videoUrl,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
